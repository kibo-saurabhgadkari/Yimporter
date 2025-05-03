import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DataStoreService } from '../../core/services/data-store.service';
import { Transaction } from '../../core/models/transaction.model';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.css']
})
export class PreviewComponent implements OnInit, OnDestroy {
  title = 'Preview Transactions';
  transactions: Transaction[] = [];
  
  private router = inject(Router);
  private dataStoreService = inject(DataStoreService);
  private subscription = new Subscription();
  
  ngOnInit(): void {
    console.log('Preview component initialized');
    
    // Get initial transactions
    this.transactions = this.dataStoreService.getTransactions();
    console.log('Initial transactions:', this.transactions);
    
    // Subscribe to transactions data
    this.subscription.add(
      this.dataStoreService.transactions$.subscribe(transactions => {
        console.log('Transaction data updated:', transactions);
        this.transactions = transactions;
        
        // If no transactions, redirect to upload
        if (transactions.length === 0) {
          console.log('No transactions, redirecting to upload');
          this.router.navigate(['/upload']);
        }
      })
    );
    
    // If no transactions, redirect to upload
    if (this.transactions.length === 0) {
      console.log('No initial transactions, redirecting to upload');
      this.router.navigate(['/upload']);
    }
  }
  
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
  
  /**
   * Get total inflow amount
   */
  getTotalInflow(): number {
    return this.transactions.reduce((sum, transaction) => sum + transaction.inflow, 0);
  }
  
  /**
   * Get total outflow amount
   */
  getTotalOutflow(): number {
    return this.transactions.reduce((sum, transaction) => sum + transaction.outflow, 0);
  }
  
  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }
  
  /**
   * Navigate back to upload page
   */
  goBack(): void {
    this.router.navigate(['/upload']);
  }
  
  /**
   * Proceed to export page
   */
  proceedToExport(): void {
    this.router.navigate(['/export']);
  }
}