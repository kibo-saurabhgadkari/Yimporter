import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

export interface ExportOptions {
  includeHeader: boolean;
  sanitizeData: boolean;
  format: 'ynab' | 'custom';
  filename: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() { }

  /**
   * Generate a CSV file in YNAB format from the provided transactions
   * @param transactions The transactions to export
   * @param options Export configuration options
   */
  public exportToYnabCsv(transactions: Transaction[], options: ExportOptions): void {
    // YNAB CSV Headers
    const headers = ['Date', 'Payee', 'Memo', 'Outflow', 'Inflow'];
    
    // Format the CSV content
    const csvContent = this.generateCsvContent(headers, transactions, options);
    
    // Create a blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link and trigger the download
    this.downloadCsv(blob, `${options.filename}.csv`);
  }
  
  /**
   * Generate a preview of the CSV data
   * @param transactions The transactions to preview
   * @param options Export configuration options
   * @param maxRows Maximum number of rows to include in preview
   */
  public generatePreview(transactions: Transaction[], options: ExportOptions, maxRows: number = 5): string[] {
    const headers = ['Date', 'Payee', 'Memo', 'Outflow', 'Inflow'];
    const preview: string[] = [];
    
    // Add headers if includeHeader is true
    if (options.includeHeader) {
      preview.push(headers.join(','));
    }
    
    // Add transaction rows (limited to maxRows)
    const previewTransactions = transactions.slice(0, maxRows);
    
    previewTransactions.forEach(transaction => {
      const row = [
        transaction.date,
        this.formatForPreview(transaction.payee, options.sanitizeData),
        this.formatForPreview(transaction.memo, options.sanitizeData),
        transaction.outflow > 0 ? transaction.outflow.toFixed(2) : '',
        transaction.inflow > 0 ? transaction.inflow.toFixed(2) : ''
      ];
      
      preview.push(row.join(','));
    });
    
    return preview;
  }
  
  /**
   * Format field for display in preview
   */
  private formatForPreview(field: string, sanitize: boolean): string {
    if (!field) return '';
    
    // Truncate long fields for preview
    let result = field.length > 25 ? field.substring(0, 22) + '...' : field;
    
    // Sanitize if needed
    if (sanitize) {
      result = result.replace(/[^\w\s\.,\-]/g, '');
    }
    
    return this.escapeCsvField(result);
  }
  
  /**
   * Generate CSV content from headers and transactions
   */
  private generateCsvContent(headers: string[], transactions: Transaction[], options: ExportOptions): string {
    let csv = '';
    
    // Add headers if includeHeader is true
    if (options.includeHeader) {
      csv = headers.join(',') + '\n';
    }
    
    // Add transaction rows
    transactions.forEach(transaction => {
      // Map transaction properties to YNAB format
      const payee = options.sanitizeData ? this.sanitizeField(transaction.payee) : transaction.payee;
      const memo = options.sanitizeData ? this.sanitizeField(transaction.memo) : transaction.memo;
      
      const row = [
        transaction.date,
        this.escapeCsvField(payee),
        this.escapeCsvField(memo),
        transaction.outflow > 0 ? transaction.outflow.toFixed(2) : '',
        transaction.inflow > 0 ? transaction.inflow.toFixed(2) : ''
      ];
      
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  /**
   * Remove special characters from a field
   */
  private sanitizeField(field: string): string {
    if (!field) return '';
    return field.replace(/[^\w\s\.,\-]/g, '');
  }

  /**
   * Properly escape CSV field values
   */
  private escapeCsvField(field: string): string {
    if (!field) return '';
    
    // If the field contains commas, quotes, or newlines, enclose in quotes
    if (/[",\n\r]/.test(field)) {
      // Double any existing quotes
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }
  
  /**
   * Trigger file download in the browser
   */
  private downloadCsv(blob: Blob, filename: string): void {
    // Create a temporary download link
    const link = document.createElement('a');
    
    // Create a URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // Add to document, trigger download, and clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}