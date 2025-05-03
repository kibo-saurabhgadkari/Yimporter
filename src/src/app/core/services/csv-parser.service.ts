import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Interface for parsed CSV data
 */
export interface ParsedData {
  headers: string[];
  rows: any[][];
  fileName: string;
  detectedFormat?: string;
}

/**
 * Options for CSV parsing
 */
export interface CsvParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  skipRows?: number;
  trimValues?: boolean;
}

/**
 * Service for parsing CSV files
 */
@Injectable({
  providedIn: 'root'
})
export class CsvParserService {
  private parsedDataSubject = new BehaviorSubject<ParsedData | null>(null);
  public parsedData$ = this.parsedDataSubject.asObservable();

  constructor() { }

  /**
   * Parse a CSV file and return the parsed data
   */
  public async parseFile(file: File, options: CsvParseOptions = {}): Promise<ParsedData> {
    try {
      const content = await this.readFileContent(file);
      
      console.log(`Processing file: ${file.name}`);
      
      // Check for ICICI Credit Card statement first - most likely to need specialized parsing
      if ((file.name.toLowerCase().includes('icici') || 
           file.name.toLowerCase().includes('cc')) && 
          (content.includes('VIEW CURRENT STATEMENT') || 
           content.includes('VIEW LAST STATEMENT'))) {
        console.log('Detected ICICI Credit Card statement based on header content');
        return this.parseICICICreditCardStatement(content, file.name);
      }
      
      // Special handling for Axis Bank statements
      if (file.name.toLowerCase().includes('axis') && 
          (file.name.toLowerCase().includes('statement') || file.name.toLowerCase().includes('bank'))) {
        console.log('Detected Axis Bank Statement, applying special parsing');
        return this.parseAxisBankStatement(content, file.name);
      }
      
      // If no specific format detected, try the generic CSV parser
      const parseResult = this.parseCSV(content, options);
      
      const result: ParsedData = {
        headers: parseResult.headers,
        rows: parseResult.rows,
        fileName: file.name,
        detectedFormat: this.detectFileFormat(file.name, parseResult.headers)
      };

      this.parsedDataSubject.next(result);
      return result;
    } catch (error) {
      console.error('Error parsing CSV file:', error);
      throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Comprehensive parser for ICICI Credit Card statements
   * Handles both CURRENT and LAST statement formats
   */
  private parseICICICreditCardStatement(content: string, fileName: string): ParsedData {
    console.log('Starting comprehensive ICICI Credit Card statement parsing');
    
    try {
      // Split into lines
      const lines = content
        .split(/\r\n|\n|\r/)
        .filter(line => line.trim() !== '');
      
      console.log(`ICICI Credit Card CSV: Found ${lines.length} non-empty lines`);
      
      // First, determine if this is a CURRENT or LAST statement
      const isLastStatement = content.includes('VIEW LAST STATEMENT');
      const statementType = isLastStatement ? 'LAST' : 'CURRENT';
      console.log(`Detected ICICI ${statementType} statement format`);
      
      // Find the "Transaction Details" section
      let transactionHeaderIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Transaction Details')) {
          transactionHeaderIndex = i;
          console.log(`Found Transaction Details header at line ${i}`);
          break;
        }
      }
      
      if (transactionHeaderIndex === -1) {
        console.error('Could not find Transaction Details section in ICICI Credit Card statement');
        throw new Error('Failed to locate Transaction Details section');
      }
      
      // The next line contains column headers
      const headerRowIndex = transactionHeaderIndex + 1;
      if (headerRowIndex >= lines.length) {
        throw new Error('No column headers found after Transaction Details section');
      }
      
      console.log('Column header row:', lines[headerRowIndex]);
      
      // Analyze the header row to determine column structure
      const headerRow = this.parseCsvLine(lines[headerRowIndex], ',');
      
      // Determine indices for key columns based on statement format
      const columnStructure = this.determineICICIColumnStructure(headerRow, isLastStatement);
      console.log('Determined column structure:', columnStructure);
      
      // Create custom headers based on the determined structure
      const customHeaders = Array(columnStructure.totalColumns).fill('').map((_, i) => {
        if (i === columnStructure.dateIndex) return 'Transaction Date';
        if (i === columnStructure.detailsIndex) return 'Details';
        if (i === columnStructure.amountIndex) return 'Amount (INR)';
        if (i === columnStructure.referenceIndex) return 'Reference Number';
        return `empty${i}`;
      });
      
      // Parse transaction rows starting after the header row
      const transactions = [];
      for (let i = headerRowIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip if we've hit another section
        if (line.includes('Statement Summary') || 
            line.includes('Payment Summary') || 
            line.includes('Total Due') || 
            line.includes('Closing Balance')) {
          console.log(`Stopping at section marker: ${line}`);
          break;
        }
        
        const row = this.parseCsvLine(line, ',');
        
        // Validate that this row has sufficient columns
        if (row.length < Math.max(
            columnStructure.dateIndex, 
            columnStructure.amountIndex, 
            columnStructure.referenceIndex) + 1) {
          console.log(`Row ${i} doesn't have enough columns: ${row.length}, skipping`);
          continue;
        }
        
        // Check if this is a valid transaction row by looking at the date and amount
        const dateValue = row[columnStructure.dateIndex];
        const amountValue = row[columnStructure.amountIndex];
        
        // Skip rows without date or amount
        if (!dateValue || !amountValue) {
          continue;
        }
        
        // Validate date format (DD/MM/YYYY)
        const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const isValidDate = Boolean(dateValue && dateRegex.test(dateValue.toString().trim()));
        
        // Validate amount contains Dr. or Cr.
        const isValidAmount = Boolean(amountValue && 
                               (amountValue.toString().includes('Dr.') || 
                                amountValue.toString().includes('Cr.')));
        
        if (isValidDate && isValidAmount) {
          console.log(`Adding valid transaction from line ${i}: date=${dateValue}, amount=${amountValue}`);
          transactions.push(row);
        } else {
          console.log(`Skipping invalid transaction: date valid=${isValidDate}, amount valid=${isValidAmount}`);
        }
      }
      
      console.log(`Successfully extracted ${transactions.length} valid transactions`);
      
      return {
        headers: customHeaders,
        rows: transactions,
        fileName,
        detectedFormat: 'ICICI_CC'
      };
      
    } catch (error) {
      console.error('Error parsing ICICI Credit Card statement:', error);
      throw new Error(`Failed to parse ICICI Credit Card Statement: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Determine column structure for ICICI Credit Card statements
   */
  private determineICICIColumnStructure(headerRow: string[], isLastStatement: boolean): {
    dateIndex: number,
    detailsIndex: number,
    amountIndex: number,
    referenceIndex: number,
    totalColumns: number
  } {
    // Sample the header row to find out where the important columns are
    console.log('Analyzing header row:', headerRow);
    
    let dateIndex = -1;
    let detailsIndex = -1;
    let amountIndex = -1;
    let referenceIndex = -1;
    
    // Find column positions based on the header labels
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i]?.trim().toLowerCase() || '';
      
      if (header.includes('date')) {
        dateIndex = i;
      } else if (header.includes('details')) {
        detailsIndex = i;
      } else if (header.includes('amount')) {
        amountIndex = i;
      } else if (header.includes('reference')) {
        referenceIndex = i;
      }
    }
    
    // If we couldn't find the columns by name, use default positions
    // based on statement type
    if (dateIndex === -1) dateIndex = 2;  // Both formats usually have date at index 2
    if (detailsIndex === -1) detailsIndex = 3;  // Both formats usually have details at index 3
    
    if (amountIndex === -1) {
      // Amount is usually at index 5 for CURRENT and index 6 for LAST
      amountIndex = isLastStatement ? 6 : 5;
    }
    
    if (referenceIndex === -1) {
      // Reference is usually at index 7 for CURRENT and index 9 for LAST
      referenceIndex = isLastStatement ? 9 : 7;
    }
    
    // Count the total number of columns
    const totalColumns = Math.max(
      dateIndex, 
      detailsIndex,
      amountIndex,
      referenceIndex
    ) + 2;  // Add 2 to ensure we have enough columns
    
    return {
      dateIndex,
      detailsIndex,
      amountIndex,
      referenceIndex,
      totalColumns
    };
  }

  /**
   * Special parser designed specifically for Axis Bank Statement format
   */
  private parseAxisBankStatement(content: string, fileName: string): ParsedData {
    // Split content into lines and filter out empty lines
    const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
    console.log(`Axis Bank Statement has ${lines.length} lines`);
    
    // Look for the transaction header line (contains "Tran Date" and "PARTICULARS")
    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ((line.includes('Tran Date') || line.includes('Transaction Date')) && 
          (line.includes('PARTICULARS') || line.includes('Particulars'))) {
        headerLineIndex = i;
        console.log(`Found transaction header at line ${i}: ${line}`);
        break;
      }
    }
    
    if (headerLineIndex === -1) {
      console.error('Failed to find transaction headers in Axis Bank statement');
      // Fall back to a more aggressive search if we didn't find it the first time
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if ((line.includes('date') || line.includes('tran')) && 
            (line.includes('particular') || line.includes('narration'))) {
          headerLineIndex = i;
          console.log(`Found likely transaction header using fallback at line ${i}: ${lines[i]}`);
          break;
        }
      }
      
      // If still not found, try line 17 (common position in Axis statements)
      if (headerLineIndex === -1 && lines.length > 17) {
        headerLineIndex = 17;
        console.log(`Using default header position at line 17: ${lines[17]}`);
      }
      
      // If all attempts failed, return empty data
      if (headerLineIndex === -1) {
        console.error('All attempts to find transaction headers failed');
        return { headers: [], rows: [], fileName, detectedFormat: 'Unknown' };
      }
    }
    
    // Get the transaction headers
    const headerLine = lines[headerLineIndex];
    const headers = headerLine.split(',').map(h => h.trim());
    console.log('Found headers:', headers);
    
    // Validate headers - must have at least date and description
    if (headers.length < 3 || 
        !headers.some(h => h.toLowerCase().includes('date')) || 
        !headers.some(h => h.toLowerCase().includes('particular'))) {
      console.error('Invalid headers detected in Axis Bank statement:', headers);
      return { headers: [], rows: [], fileName, detectedFormat: 'Unknown' };
    }
    
    // Process transaction rows
    const transactionRows: string[][] = [];
    
    // Process rows after the header until we hit a footer section
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines or lines that look like footers
      if (line.length === 0 || 
          line.startsWith('"Unless') || 
          line.startsWith('Legend') ||
          line.includes('REGISTERED OFFICE') ||
          line.includes('The closing balance')) {
        continue;
      }
      
      // Stop if we hit what looks like a footer section
      if (line.startsWith('"') && line.length > 30) {
        console.log('Reached footer section, stopping transaction parsing');
        break;
      }
      
      try {
        // Process the transaction row
        const values = this.splitCsvRow(line);
        
        // Validate that this is likely a transaction row (check if first column is a date)
        if (values.length >= 3 && this.looksLikeDate(values[0])) {
          console.log('Parsed transaction row:', values);
          
          // Ensure all values are trimmed to remove excess spaces
          const cleanedValues = values.map(v => v.trim());
          
          // Make sure it has the right number of columns
          if (cleanedValues.length < headers.length) {
            const paddedValues = [...cleanedValues];
            while (paddedValues.length < headers.length) {
              paddedValues.push('');
            }
            transactionRows.push(paddedValues);
          } else {
            transactionRows.push(cleanedValues);
          }
        } else {
          console.log('Skipping non-transaction row:', line);
        }
      } catch (error) {
        console.error('Error parsing transaction row:', line, error);
        // Continue to next row rather than failing completely
      }
    }
    
    console.log(`Found ${transactionRows.length} transaction rows`);
    
    // Validate we found at least some transactions
    if (transactionRows.length === 0) {
      console.warn('No transactions found in Axis Bank statement, checking for alternative format');
      
      // Try an alternative approach if no transactions were found
      // This is a fallback for statements with different formatting
      for (let i = headerLineIndex + 1; i < Math.min(headerLineIndex + 20, lines.length); i++) {
        const line = lines[i].trim();
        if (line && line.includes(',') && !line.startsWith('"') && !line.includes('Unless')) {
          try {
            const values = this.splitCsvRow(line);
            // Add any row that has numbers in it as a potential transaction
            if (values.length >= 3 && values.some(v => /\d/.test(v))) {
              console.log('Found alternative format transaction:', values);
              transactionRows.push(values.map(v => v.trim()));
            }
          } catch (error) {
            console.error('Error in alternative parsing approach:', error);
          }
        }
      }
    }
    
    // Create the parsed data result
    const result: ParsedData = {
      headers,
      rows: transactionRows,
      fileName,
      detectedFormat: 'Axis_Bank'
    };
    
    this.parsedDataSubject.next(result);
    return result;
  }

  /**
   * Special parser for ICICI Credit Card statements which have a complex format
   */
  private parseICICICreditCardCSV(content: string, fileName: string): ParsedData {
    console.log('Starting specialized ICICI Credit Card statement parsing');
    
    // Split into lines
    const lines = content
      .split(/\r\n|\n|\r/)
      .filter(line => line.trim() !== '');
    
    console.log(`ICICI Credit Card CSV: Found ${lines.length} non-empty lines`);
    
    // First, check if this is really an ICICI Credit Card statement
    // Check first 10 lines for key identifiers
    const firstLines = lines.slice(0, Math.min(10, lines.length)).join(' ');
    if (!firstLines.includes('Credit Card Details') && !firstLines.includes('VIEW CURRENT STATEMENT')) {
      console.warn('This does not appear to be an ICICI Credit Card statement');
      const fallbackResult = this.parseCSV(content, {});
      return {
        ...fallbackResult,
        fileName,
        detectedFormat: 'Unknown'
      };
    }
    
    // Find the "Transaction Details" section
    let transactionHeaderIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('Transaction Details')) {
        transactionHeaderIndex = i;
        console.log(`Found Transaction Details header at line ${i}:`, lines[i]);
        break;
      }
    }
    
    if (transactionHeaderIndex === -1) {
      console.error('Could not find Transaction Details section in ICICI Credit Card statement');
      const fallbackResult = this.parseCSV(content, {});
      return {
        ...fallbackResult,
        fileName,
        detectedFormat: 'ICICI_CC'
      };
    }
    
    // The next row should contain column headers (Transaction Date, Details, Amount, etc.)
    const headersRowIndex = transactionHeaderIndex + 1;
    if (headersRowIndex >= lines.length) {
      console.error('No header row found after Transaction Details');
      const fallbackResult = this.parseCSV(content, {});
      return {
        ...fallbackResult,
        fileName,
        detectedFormat: 'ICICI_CC'
      };
    }
    
    // Define the expected structure of the data based on the sample
    // The ICICI Credit Card statement has specific column structure:
    // - Empty columns at positions 0, 1, 4, 6, 8
    // - Transaction Date at position 2
    // - Details at position 3
    // - Amount at position 5
    // - Reference Number at position 7
    const customHeaders = [
      'empty1',
      'empty2', 
      'Transaction Date', 
      'Details', 
      'empty4',
      'Amount (INR)',
      'empty6',
      'Reference Number',
      'empty8'
    ];
    
    // Start processing from the row after the headers
    const dataStartRowIndex = headersRowIndex + 1;
    const transactionRows = [];
    
    // Process each line after the headers as potential transaction
    for (let i = dataStartRowIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Stop if we hit another section marker (like "Statement Summary")
      if (line.includes('Statement Summary') || line.includes('Payment Summary') || 
          line.includes('Total Due') || line.includes('Closing Balance')) {
        console.log(`Stopping at section marker: ${line}`);
        break;
      }
      
      // Skip if the line is too short or doesn't look like a transaction
      if (line.length < 10) {
        console.log(`Skipping short line: ${line}`);
        continue;
      }
      
      // Split the line handling quoted values
      // For ICICI statement we need to be careful with commas inside quoted fields
      let values = [];
      try {
        values = this.parseCsvLine(line, ',', true);
        console.log('Parsed line into values:', values);
      } catch (error) {
        console.error(`Error parsing line: ${line}`, error);
        continue;
      }
      
      // ICICI transactions have:
      // - Date at index 2 (format: DD/MM/YYYY)
      // - Details at index 3
      // - Amount with Dr./Cr. at index 5
      
      // Basic validation to ensure this looks like a transaction
      if (values.length < 6) {
        console.log(`Skipping row with insufficient columns: ${line}`);
        continue;
      }
      
      const dateValue = values[2];
      const detailsValue = values[3];
      const amountValue = values[5];
      
      // Skip rows without date or amount - essential for a transaction
      if (!dateValue || !amountValue) {
        console.log(`Skipping row missing date or amount: ${line}`);
        continue;
      }
      
      // Verify date format (DD/MM/YYYY)
      const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
      const isDateValid = dateValue && dateRegex.test(dateValue.toString().trim());
      
      // Verify amount format (includes Dr. or Cr.)
      const isAmountValid = amountValue && 
                           (amountValue.toString().includes('Dr.') || 
                            amountValue.toString().includes('Cr.'));
      
      if (isDateValid && isAmountValid) {
        console.log(`Adding transaction row: date=${dateValue}, details=${detailsValue}, amount=${amountValue}`);
        transactionRows.push(values);
      } else {
        console.log(`Skipping invalid row: date valid=${isDateValid}, amount valid=${isAmountValid}`);
      }
    }
    
    console.log(`Found ${transactionRows.length} valid transactions in ICICI Credit Card statement`);
    
    if (transactionRows.length === 0) {
      console.error('No valid transactions found in ICICI Credit Card statement');
      // Final fallback - try with the straight CSV parser
      const fallbackResult = this.parseCSV(content, {});
      return {
        ...fallbackResult,
        fileName,
        detectedFormat: 'ICICI_CC'
      };
    }
    
    // Print a sample transaction for debugging
    if (transactionRows.length > 0) {
      console.log('Sample transaction:', JSON.stringify(transactionRows[0]));
    }
    
    return {
      headers: customHeaders,
      rows: transactionRows,
      fileName,
      detectedFormat: 'ICICI_CC'
    };
  }

  /**
   * Helper to split CSV row handling quoted values
   */
  private splitCsvRow(line: string): string[] {
    const result: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    let delimiter = ',';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Add the last value
    result.push(currentValue.trim());
    
    return result;
  }

  /**
   * Check if a string looks like a date
   */
  private looksLikeDate(value: string): boolean {
    // Check common date formats
    return Boolean(
      value.match(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/) || // DD-MM-YYYY or DD/MM/YYYY
      value.match(/^\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2}$/)    // YYYY-MM-DD or YYYY/MM/DD
    );
  }

  /**
   * Parse a single CSV line handling quotes and delimiters
   */
  private parseCsvLine(line: string, delimiter: string, trimValues: boolean = true): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(trimValues ? currentValue.trim() : currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Add the last value
    values.push(trimValues ? currentValue.trim() : currentValue);
    
    // Remove quotes from values
    return values.map(value => {
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.substring(1, value.length - 1);
      }
      return value;
    });
  }

  /**
   * Read the content of a file as text
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Parse CSV content into headers and rows
   */
  private parseCSV(content: string, options: CsvParseOptions): { headers: string[], rows: any[][] } {
    const {
      delimiter = this.detectDelimiter(content),
      hasHeader = true,
      skipRows = 0,
      trimValues = true
    } = options;

    // Split content into lines
    let lines = content.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
    
    // Skip specified number of rows
    if (skipRows > 0) {
      lines = lines.slice(skipRows);
    }
    
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Parse rows
    const rows = lines.map(line => {
      // Handle quoted values properly
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(trimValues ? currentValue.trim() : currentValue);
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      values.push(trimValues ? currentValue.trim() : currentValue);
      
      // Remove quotes from values
      return values.map(value => {
        if (value.startsWith('"') && value.endsWith('"')) {
          return value.substring(1, value.length - 1);
        }
        return value;
      });
    });

    // Extract headers if needed
    let headers: string[] = [];
    if (hasHeader && rows.length > 0) {
      headers = rows.shift() || [];
    } else {
      // Generate default headers (Column1, Column2, etc.)
      const columnCount = rows.length > 0 ? rows[0].length : 0;
      headers = Array.from({ length: columnCount }, (_, i) => `Column${i + 1}`);
    }

    return { headers, rows };
  }

  /**
   * Auto-detect the delimiter used in the CSV content
   */
  private detectDelimiter(content: string): string {
    const firstLine = content.split(/\r\n|\n|\r/)[0];
    
    // Check for common delimiters
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: (firstLine.match(new RegExp(`[^"']${delimiter}[^"']`, 'g')) || []).length
    }));
    
    // Find the delimiter with the highest count
    const detected = counts.sort((a, b) => b.count - a.count)[0];
    
    // Default to comma if no delimiter is detected
    return detected.count > 0 ? detected.delimiter : ',';
  }

  /**
   * Detect the file format based on filename and headers
   */
  private detectFileFormat(fileName: string, headers: string[]): string {
    // Convert filename and headers to lowercase for case-insensitive comparison
    const fileNameLower = fileName.toLowerCase();
    const headersLower = headers.map(h => h.toLowerCase());
    
    console.log('Detecting file format for:', fileNameLower);
    console.log('Headers for format detection:', headersLower);
    
    // Check for ICICI Bank Statement
    if (
      fileNameLower.includes('icici') && 
      fileNameLower.includes('bank') && 
      !fileNameLower.includes('credit') &&
      (headersLower.includes('transaction date') || headersLower.includes('value date'))
    ) {
      console.log('Detected format: ICICI_Bank');
      return 'ICICI_Bank';
    }
    
    // Check for ICICI Credit Card Statement
    if (
      fileNameLower.includes('icici') && 
      (fileNameLower.includes('credit') || fileNameLower.includes('cc')) &&
      (headersLower.includes('transaction date') || headersLower.includes('date'))
    ) {
      console.log('Detected format: ICICI_CC');
      return 'ICICI_CC';
    }
    
    // Check for Axis Bank Statement - more flexible detection
    if (
      (fileNameLower.includes('axis') && fileNameLower.includes('bank') && !fileNameLower.includes('credit')) ||
      (headersLower.includes('tran date') || 
       headersLower.includes('transaction date') || 
       headersLower.some(h => h.includes('particulars')) && 
       headersLower.some(h => h.includes('withdrawal')) && 
       headersLower.some(h => h.includes('deposit')))
    ) {
      console.log('Detected format: Axis_Bank');
      return 'Axis_Bank';
    }
    
    // Check for Axis Credit Card Statement
    if (
      fileNameLower.includes('axis') && 
      (fileNameLower.includes('credit') || fileNameLower.includes('cc')) &&
      (headersLower.includes('transaction date') || headersLower.includes('date'))
    ) {
      console.log('Detected format: Axis_CC');
      return 'Axis_CC';
    }
    
    // Check for HDFC Credit Card Statement
    if (
      fileNameLower.includes('hdfc') && 
      (fileNameLower.includes('credit') || fileNameLower.includes('cc')) &&
      (headersLower.includes('transaction date') || headersLower.includes('date'))
    ) {
      console.log('Detected format: HDFC_CC');
      return 'HDFC_CC';
    }
    
    // If we can determine from headers alone
    if (headersLower.some(h => h.includes('tran date') || h.includes('transaction date')) &&
        headersLower.some(h => h.includes('particulars')) && 
        headersLower.some(h => h.includes('withdrawal') || h.includes('debit')) && 
        headersLower.some(h => h.includes('deposit') || h.includes('credit'))) 
    {
      console.log('Detected format from headers: Axis_Bank');
      return 'Axis_Bank';
    }
    
    console.log('Unknown format detected');
    return 'Unknown';
  }

  /**
   * Clear the currently parsed data
   */
  public clearParsedData(): void {
    this.parsedDataSubject.next(null);
  }
}