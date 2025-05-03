import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
  
  constructor(private router: Router) {}
  
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
   * Simulate file upload with progress
   */
  simulateUpload(file: UploadFile): void {
    file.status = 'uploading';
    
    // Simulate upload progress
    const interval = setInterval(() => {
      file.progress += 10;
      
      if (file.progress >= 100) {
        clearInterval(interval);
        file.progress = 100;
        file.status = 'success';
        
        // Check if all files are processed
        this.checkAllFilesProcessed();
      }
    }, 300);
  }
  
  /**
   * Check if all files have been processed
   */
  checkAllFilesProcessed(): void {
    const allProcessed = this.files.every(file => 
      file.status === 'success' || file.status === 'error');
    
    const hasSuccessfulFiles = this.files.some(file => file.status === 'success');
    
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
  }
  
  /**
   * Proceed to preview screen
   */
  proceedToPreview(): void {
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