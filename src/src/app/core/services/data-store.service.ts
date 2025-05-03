import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Transaction } from '../models/transaction.model';
import { ParsedData } from './csv-parser.service';

/**
 * Service to store and share data between components
 */
@Injectable({
  providedIn: 'root'
})
export class DataStoreService {
  private parsedDataSubject = new BehaviorSubject<ParsedData | null>(null);
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  
  public parsedData$: Observable<ParsedData | null> = this.parsedDataSubject.asObservable();
  public transactions$: Observable<Transaction[]> = this.transactionsSubject.asObservable();
  
  constructor() { }
  
  /**
   * Set the parsed data
   */
  public setParsedData(data: ParsedData | null): void {
    this.parsedDataSubject.next(data);
  }
  
  /**
   * Get the current parsed data
   */
  public getParsedData(): ParsedData | null {
    return this.parsedDataSubject.getValue();
  }
  
  /**
   * Set the transactions
   */
  public setTransactions(transactions: Transaction[]): void {
    this.transactionsSubject.next(transactions);
  }
  
  /**
   * Get the current transactions
   */
  public getTransactions(): Transaction[] {
    return this.transactionsSubject.getValue();
  }
  
  /**
   * Clear all data
   */
  public clearAll(): void {
    this.parsedDataSubject.next(null);
    this.transactionsSubject.next([]);
  }
}