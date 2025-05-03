import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CsvParserService } from '../../core/services/csv-parser.service';
import { TransactionMapperService } from '../../core/services/transaction-mapper.service';
import { DataStoreService } from '../../core/services/data-store.service';

interface UploadFile {
  file: File;
  name: string;
  size: string;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  title = 'Upload Files';
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  files: UploadFile[] = [];
  isDragging = false;
  
  // Maximum file size in bytes (10MB)
  maxFileSize = 10 * 1024 * 1024; 
  
  // Allowed file types
  allowedFileTypes = ['.csv', '.xlsx', '.xls', '.pdf'];
  
  // Inject services
  private router = inject(Router);
  private csvParserService = inject(CsvParserService);
  private transactionMapperService = inject(TransactionMapperService);
  private dataStoreService = inject(DataStoreService);
  
  /**
   * Triggers file input click
   */
  openFileDialog(): void {
    this.fileInput.nativeElement.click();
  }
  
  /**
   * Handle the file selection from input element
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processFiles(input.files);
    }
  }
  
  /**
   * Handle the file drop event
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    if (event.dataTransfer?.files) {
      this.processFiles(event.dataTransfer.files);
    }
  }
  
  /**
   * Handle dragover event
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }
  
  /**
   * Handle dragleave event
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }
  
  /**
   * Process the files selected by the user
   */
  processFiles(fileList: FileList): void {
    Array.from(fileList).forEach(file => {
      // Check if file type is allowed
      const fileExtension = this.getFileExtension(file.name);
      const isValidType = this.allowedFileTypes.includes(fileExtension);
      
      // Check if file size is within limits
      const isValidSize = file.size <= this.maxFileSize;
      
      const uploadFile: UploadFile = {
        file: file,
        name: file.name,
        size: this.formatFileSize(file.size),
        type: file.type,
        progress: 0,
        status: 'pending'
      };
      
      // Handle validation errors
      if (!isValidType) {
        uploadFile.status = 'error';
        uploadFile.errorMessage = `Invalid file type. Allowed types: ${this.allowedFileTypes.join(', ')}`;
      } else if (!isValidSize) {
        uploadFile.status = 'error';
        uploadFile.errorMessage = `File too large. Maximum size: ${this.formatFileSize(this.maxFileSize)}`;
      }
      
      // Add to files array
      this.files.push(uploadFile);
      
      // If file is valid, simulate upload
      if (isValidType && isValidSize) {
        this.simulateUpload(uploadFile);
      }
    });
  }
  
  /**
   * Get file extension from filename
   */
  getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
  }
  
  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Simulate file upload with progress and parse CSV if applicable
   */
  simulateUpload(file: UploadFile): void {
    const total = 100;
    let progress = 0;
    
    // Set the file status to uploading
    file.status = 'uploading';
    file.progress = 0;
    
    // Update the progress bar at intervals
    const interval = setInterval(() => {
      progress += 10;
      file.progress = progress;
      
      if (progress >= total) {
        clearInterval(interval);
        
        // Only process CSV, Excel, and PDF files
        if (file.file.type === 'text/csv' || file.file.name.endsWith('.csv')) {
          console.log('Processing CSV file:', file.file.name);
          this.processCsvFile(file);
        } else if (
          file.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.file.type === 'application/vnd.ms-excel' ||
          file.file.name.endsWith('.xlsx') ||
          file.file.name.endsWith('.xls')
        ) {
          console.log('Processing Excel file:', file.file.name);
          this.processExcelFile(file);
        } else if (file.file.type === 'application/pdf' || file.file.name.endsWith('.pdf')) {
          console.log('Processing PDF file:', file.file.name);
          this.processPdfFile(file);
        } else {
          console.error('Unsupported file type:', file.file.type);
          file.status = 'error';
          file.errorMessage = 'Unsupported file type. Please upload a CSV, Excel, or PDF file.';
        }
      }
    }, 200);
  }

  /**
   * Process a CSV file
   */
  async processCsvFile(file: UploadFile): Promise<void> {
    try {
      console.log('Starting CSV processing for file:', file.file.name);
      
      // Special detection for ICICI Credit Card statements
      const isIciciCreditCard = file.file.name.toLowerCase().includes('icici') && 
                               file.file.name.toLowerCase().includes('credit');
      
      if (isIciciCreditCard) {
        console.log('Detected ICICI Credit Card Statement file');
      }
      
      const parsedData = await this.csvParserService.parseFile(file.file);
      console.log('CSV parsing completed, result:', parsedData);
      
      // If this is an ICICI Credit Card statement and not already marked as such
      if (isIciciCreditCard && parsedData.detectedFormat !== 'ICICI_CC') {
        console.log('Explicitly setting format to ICICI_CC based on filename');
        parsedData.detectedFormat = 'ICICI_CC';
      }
      
      console.log('Detected format:', parsedData.detectedFormat);
      
      const transactions = this.transactionMapperService.mapToTransactions(parsedData);
      console.log('Mapped transactions:', transactions);
      
      if (transactions.length === 0) {
        console.error('No transactions were mapped from the CSV file');
        file.status = 'error';
        file.errorMessage = 'Failed to extract transactions from the CSV file. The file format may not be supported.';
        return;
      }
      
      // Store the transactions for the preview component
      this.dataStoreService.setTransactions(transactions);
      console.log('Transactions stored in data store:', transactions.length);
      
      file.status = 'success';
    } catch (error) {
      console.error('Error processing CSV file:', error);
      file.status = 'error';
      file.errorMessage = error instanceof Error ? error.message : 'An error occurred while processing the CSV file.';
    }
  }
  
  /**
   * Process an Excel file
   * Currently just a placeholder as Excel processing is not implemented yet
   */
  async processExcelFile(file: UploadFile): Promise<void> {
    console.log('Excel file processing not yet implemented');
    file.status = 'error';
    file.errorMessage = 'Excel file processing is not yet implemented.';
  }

  /**
   * Process a PDF file
   * Currently just a placeholder as PDF processing is not yet implemented
   */
  async processPdfFile(file: UploadFile): Promise<void> {
    console.log('PDF file processing not yet implemented');
    file.status = 'error';
    file.errorMessage = 'PDF file processing is not yet implemented.';
  }

  /**
   * Check if all files have been processed
   */
  checkAllFilesProcessed(): void {
    const allProcessed = this.files.every(file => 
      file.status === 'success' || file.status === 'error');
    
    const hasSuccessfulFiles = this.hasSuccessfulUploads();
    
    // If all files are processed and at least one was successful,
    // enable the proceed button
    if (allProcessed && hasSuccessfulFiles) {
      // We could automatically navigate to preview
      // Uncomment to enable auto-navigation
      // setTimeout(() => this.router.navigate(['/preview']), 1000);
    }
  }
  
  /**
   * Remove a file from the list
   */
  removeFile(index: number): void {
    this.files.splice(index, 1);
  }
  
  /**
   * Clear all files from the list
   */
  clearFiles(): void {
    this.files = [];
    
    // Clear stored data
    this.dataStoreService.clearAll();
  }
  
  /**
   * Proceed to preview screen
   */
  proceedToPreview(): void {
    // Check if we have any transactions to preview
    const transactions = this.dataStoreService.getTransactions();
    
    if (transactions.length === 0) {
      // If no transactions are available, show an error message
      console.error('No transactions available to preview');
      alert('No transaction data available. Please upload a valid CSV file first.');
      return;
    }
    
    console.log('Navigating to preview with transactions:', transactions);
    
    // Navigate to preview screen
    this.router.navigate(['/preview']);
  }
  
  // Helper methods for template
  isPending(file: UploadFile): boolean {
    return file.status === 'pending';
  }
  
  isUploading(file: UploadFile): boolean {
    return file.status === 'uploading';
  }
  
  isSuccess(file: UploadFile): boolean {
    return file.status === 'success';
  }
  
  isError(file: UploadFile): boolean {
    return file.status === 'error';
  }
  
  shouldShowProgressBar(file: UploadFile): boolean {
    return file.status === 'uploading' || file.status === 'success';
  }
  
  hasSuccessfulUploads(): boolean {
    return this.files.some(file => file.status === 'success');
  }
}