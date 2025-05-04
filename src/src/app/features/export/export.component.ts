import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { DataStoreService } from '../../core/services/data-store.service';
import { ExportService, ExportOptions } from '../../core/services/export.service';
import { Transaction } from '../../core/models/transaction.model';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './export.component.html',
  styleUrls: ['./export.component.css']
})
export class ExportComponent implements OnInit, OnDestroy {
  title = 'Export to YNAB';
  exportForm!: FormGroup;
  transactions: Transaction[] = [];
  private subscription: Subscription = new Subscription();
  previewData: string[] = [];
  
  constructor(
    private dataStore: DataStoreService,
    private exportService: ExportService,
    private formBuilder: FormBuilder,
    private router: Router
  ) { }
  
  ngOnInit(): void {
    // Initialize form
    this.exportForm = this.formBuilder.group({
      format: ['ynab'],
      includeHeader: [true],
      sanitizeData: [true],
      filename: ['ynab-export']
    });
    
    // Listen for transactions from the data store
    this.subscription.add(
      this.dataStore.transactions$.subscribe(transactions => {
        this.transactions = transactions;
        this.updatePreview();
      })
    );
    
    // Listen for form value changes to update preview
    this.subscription.add(
      this.exportForm.valueChanges.subscribe(() => {
        this.updatePreview();
      })
    );
    
    // Check if we have transactions to export
    if (this.transactions.length === 0) {
      // Get transactions from the store
      this.transactions = this.dataStore.getTransactions();
      
      // If still no transactions, we might need to redirect to upload
      if (this.transactions.length === 0) {
        console.warn('No transactions available for export');
        // Uncomment to enable auto-redirect
        // this.router.navigate(['/upload']);
      } else {
        this.updatePreview();
      }
    }
  }
  
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
  
  /**
   * Generate a preview of the export data based on current form values
   */
  updatePreview(): void {
    if (!this.transactions || this.transactions.length === 0) {
      this.previewData = ['No data available for preview'];
      return;
    }
    
    // Get current export options from form
    const options: ExportOptions = {
      format: this.exportForm.value.format,
      includeHeader: this.exportForm.value.includeHeader,
      sanitizeData: this.exportForm.value.sanitizeData,
      filename: this.exportForm.value.filename || 'ynab-export'
    };
    
    // Generate preview using the export service
    this.previewData = this.exportService.generatePreview(this.transactions, options, 3);
    
    // Add ellipsis if there are more transactions
    if (this.transactions.length > 3) {
      this.previewData.push('...');
    }
  }
  
  /**
   * Handle export button click
   */
  onExport(): void {
    if (this.transactions.length === 0) {
      console.error('No transactions to export');
      alert('No transactions available to export. Please upload and process a file first.');
      return;
    }
    
    // Get export options from form
    const options: ExportOptions = {
      format: this.exportForm.value.format,
      includeHeader: this.exportForm.value.includeHeader,
      sanitizeData: this.exportForm.value.sanitizeData,
      filename: this.exportForm.value.filename || 'ynab-export'
    };
    
    try {
      // Export to YNAB CSV format using the export service
      this.exportService.exportToYnabCsv(this.transactions, options);
      console.log(`Exported ${this.transactions.length} transactions to ${options.filename}.csv`);
    } catch (error) {
      console.error('Error exporting data', error);
      alert('Error exporting data. Please try again.');
    }
  }
  
  /**
   * Handle back button click
   */
  onBack(): void {
    this.router.navigate(['/preview']);
  }
}