// Import Third-party Dependencies
import {
  KVOptions,
  KVPeer,
  Redis
} from "@myunisoft/redis-utils";
import { v4 as uuidv4 } from "uuid";

// Import Internal Dependencies
import {
  DispatcherMessages,
  DispatcherTransactionMetadata,
  IncomerTransactionMetadata,
  IncomerMessages
} from "types/utils";

export type Instance = "dispatcher" | "incomer";

export interface Transaction<T extends Instance = Instance> {
  event: string;
  data: T extends "dispatcher" ? DispatcherMessages : IncomerMessages;
  metadata: T extends "dispatcher" ? DispatcherTransactionMetadata : IncomerTransactionMetadata;
  aliveSince: number;
}

export type Transactions<T extends Instance = Instance> = Record<string, Transaction<T>>;

export type TransactionStoreOptions<T extends Instance = Instance> = {
  instance: T
} & Partial<KVOptions<Transactions<T>>>;

export type PartialTransaction<T extends Instance = Instance> = Omit<Transaction<T>, "metadata" | "aliveSince"> & {
  metadata: T extends "dispatcher" ? Omit<DispatcherTransactionMetadata, "transactionId"> :
  Omit<IncomerTransactionMetadata, "transactionId">
};

export class TransactionStore<T extends Instance = Instance> extends KVPeer<Transactions<T>> {
  private key: string;

  constructor(options: TransactionStoreOptions<T>, redis?: Redis) {
    super({ ...options, prefix: undefined, type: "object" }, redis);

    this.key = `${options.prefix ? `${options.prefix}-` : ""}${options.instance}-transaction`;
  }

  async getTransactions(): Promise<Transactions<T> & { metadata: null } | null> {
    return await super.getValue(this.key);
  }

  async updateTransactions(transactions: Transactions<T>): Promise<string | Buffer> {
    return await super.setValue({ value: transactions, key: this.key });
  }

  async setTransaction(transaction: PartialTransaction<T>): Promise<string> {
    const transactions = await this.getTransactions();

    const transactionId = uuidv4();

    transactions[transactionId] = {
      ...transaction,
      aliveSince: Date.now(),
      metadata: { ...transaction.metadata, transactionId }
    } as Transaction<T>;

    await this.updateTransactions(transactions);

    return transactionId;
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    const transactions = await this.getTransactions();

    return transactions[transactionId];
  }

  async deleteTransaction(transactionId: string) {
    const transactions = await this.getTransactions();

    delete transactions[transactionId];

    await this.updateTransactions(transactions);
  }
}
