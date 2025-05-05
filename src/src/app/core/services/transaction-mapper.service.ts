import { Injectable } from '@angular/core';
import { Transaction, TransactionMapping } from '../models/transaction.model';
import { ParsedData } from './csv-parser.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionMapperService {
  // Predefined mappings for different bank statement formats
  private bankMappings: Record<string, TransactionMapping> = {
    'ICICI_Bank': {
      dateColumn: 'Transaction Date',
      payeeColumn: 'Description',
      memoColumn: 'Reference Number',
      outflowColumn: 'Withdrawal Amount',
      inflowColumn: 'Deposit Amount',
      dateFormat: 'DD/MM/YYYY'
    },
    'ICICI_CC': {
      dateColumn: 'Transaction Date',
      payeeColumn: 'Details',
      memoColumn: 'Reference Number',
      amountColumn: 'Amount (INR)',
      dateFormat: 'DD/MM/YYYY',
      invertAmount: false // Already has Dr/Cr indicators
    },    'Axis_Bank': {
      dateColumn: 'Tran Date',
      payeeColumn: 'PARTICULARS',
      memoColumn: 'CHQNO',
      outflowColumn: 'DR',
      inflowColumn: 'CR',
      dateFormat: 'DD-MM-YYYY',
      numberFormat: {
        thousandsSeparator: ',',
        decimalSeparator: '.',
        trimSpaces: true
      }
    },
    'Axis_CC': {
      dateColumn: 'Transaction Date',
      payeeColumn: 'Transaction Details',
      amountColumn: 'Amount',
      dateFormat: 'DD-MM-YYYY',
      invertAmount: true
    },
    'HDFC_CC': {
      dateColumn: 'Date',
      payeeColumn: 'Particulars',
      amountColumn: 'Amount(in Rs)',
      dateFormat: 'DD/MM/YYYY',
      invertAmount: true
    },
    'Unknown': {
      // Generic mapping as fallback
      dateColumn: 'Date',
      payeeColumn: 'Description',
      memoColumn: 'Remarks',
      outflowColumn: 'Debit',
      inflowColumn: 'Credit',
      dateFormat: 'DD/MM/YYYY'
    }
  };

  constructor() { }

  /**
   * Detect the type of bank statement based on header structure and content
   */
  private detectBankStatementType(data: ParsedData): string {
    console.log('Attempting to detect bank statement type');
    const { headers, rows } = data;
    
    // Convert headers to lowercase for easier comparison
    const headerString = headers.join(' ').toLowerCase();
    
    // Check for common identifying information in the first few rows
    const firstRowsText = rows.slice(0, 10).map(row => row.join(' ')).join(' ').toLowerCase();
    
    // Look for ICICI Credit Card specific identifiers
    if (firstRowsText.includes('view current statement') && 
        (firstRowsText.includes('my credit card details') || 
         firstRowsText.includes('transaction details'))) {
      console.log('Detected ICICI Credit Card statement');
      return 'ICICI_CC';
    }
    
    // Check for Axis Bank Credit Card format
    if (headerString.includes('transaction details') && 
        headerString.includes('amount') && 
        firstRowsText.includes('axis bank')) {
      console.log('Detected Axis Bank Credit Card statement');
      return 'Axis_CC';
    }
      // Check for Axis Bank Statement
    if ((headerString.includes('tran date') && headerString.includes('particulars')) ||
        (headerString.includes('date') && headerString.includes('particulars') && 
         (headerString.includes('dr') || headerString.includes('cr') || headerString.includes('debit') || headerString.includes('credit')))) {
      console.log('Detected Axis Bank Statement');
      return 'Axis_Bank';
    }
    
    // Check for ICICI Bank Statement
    if (headerString.includes('transaction date') && 
        headerString.includes('description') && 
        (headerString.includes('withdrawal amount') || headerString.includes('deposit amount'))) {
      console.log('Detected ICICI Bank Statement');
      return 'ICICI_Bank';
    }
    
    // Check for HDFC Credit Card
    if (headerString.includes('date') && 
        headerString.includes('particulars') && 
        headerString.includes('amount(in rs)')) {
      console.log('Detected HDFC Credit Card statement');
      return 'HDFC_CC';
    }
    
    console.log('Could not detect bank statement type, using Unknown format');
    return 'Unknown';
  }

  /**
   * Preprocess the data if needed based on the detected format
   */
  private preprocessData(data: ParsedData): ParsedData {
    // For ICICI Credit Card, we need to skip the header rows and find the actual transaction data
    if (data.detectedFormat === 'ICICI_CC') {
      return this.preprocessICICICreditCard(data);
    }
    
    // For other formats, return as is for now
    return data;
  }
  
  /**
   * Preprocess ICICI Credit Card statement to extract the actual transaction rows
   */
  private preprocessICICICreditCard(data: ParsedData): ParsedData {
    console.log('Starting ICICI Credit Card preprocessing');
    const { rows } = data;
    
    // Debug first 10 rows to understand the structure
    console.log('First 10 rows of the CSV file:');
    rows.slice(0, 10).forEach((row, idx) => {
      console.log(`Row ${idx}:`, JSON.stringify(row));
    });
    
    // Find transaction details section
    let transactionHeaderIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      // Find the row containing "Transaction Details"
      if (rows[i].some(cell => cell && cell.trim() === 'Transaction Details')) {
        transactionHeaderIndex = i;
        console.log(`Found 'Transaction Details' at row ${i}:`, rows[i]);
        break;
      }
    }
    
    if (transactionHeaderIndex === -1) {
      console.error('Could not find Transaction Details row in ICICI Credit Card statement');
      return data;
    }
    
    // The next row should contain the headers for transactions
    const headersRow = transactionHeaderIndex + 1;
    
    // Create a set of custom headers to match the expected format
    // Since the header row doesn't exactly match what we need, we'll create custom headers
    const customHeaders = [
      'empty1',
      'empty2', 
      'Transaction Date', 
      'Details', 
      'empty4',
      'Amount (INR)',
      'empty6',
      'Reference Number'
    ];
    
    // Data rows start after the header row
    const dataStartRow = headersRow + 1;
    
    // Extract all rows that look like transactions
    const transactionRows = [];
    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      
      // Valid transaction rows should have:
      // 1. A date in column 2 (index 2)
      // 2. Transaction details in column 3 (index 3)
      // 3. Amount with Dr./Cr. in column 5 (index 5)
      
      // Skip rows that are too short or empty
      if (!row || row.length < 6) {
        continue;
      }
      
      const dateValue = row[2];
      const detailsValue = row[3];
      const amountValue = row[5];
      
      // Skip rows without date or amount
      if (!dateValue || !amountValue) {
        continue;
      }
      
      // Check if date matches DD/MM/YYYY pattern
      const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
      const isValidDate = dateValue && datePattern.test(dateValue.toString().trim());
      
      // Check if amount contains Dr. or Cr.
      const hasValidAmount = amountValue && 
                            (amountValue.toString().includes('Dr.') || 
                             amountValue.toString().includes('Cr.'));
      
      if (isValidDate && hasValidAmount) {
        transactionRows.push(row);
      }
    }
    
    console.log(`Found ${transactionRows.length} valid transactions in ICICI Credit Card statement`);
    
    // Print a sample transaction for debugging
    if (transactionRows.length > 0) {
      console.log('Sample transaction:', JSON.stringify(transactionRows[0]));
    }
    
    return {
      ...data,
      headers: customHeaders,
      rows: transactionRows
    };
  }

  /**
   * Map parsed CSV data to YNAB-compatible transactions
   */
  public mapToTransactions(data: ParsedData): Transaction[] {
    // First detect the bank statement type if not already set
    if (!data.detectedFormat) {
      data.detectedFormat = this.detectBankStatementType(data);
    }
    
    // Preprocess the data if needed
    const processedData = this.preprocessData(data);
    
    const format = processedData.detectedFormat || 'Unknown';
    const mapping = this.bankMappings[format];
    
    if (!mapping) {
      console.warn(`No mapping defined for format: ${format}`);
      return [];
    }

    // First try with the detected format
    const transactions = this.applyMapping(processedData, mapping);
    
    // If no transactions were extracted with the detected format, try other formats
    if (transactions.length === 0) {
      console.log('No transactions extracted with detected format. Trying alternative formats...');
      return this.iterateFormatMappings(processedData);
    }

    return transactions;
  }

  /**
   * Iterate through all available format mappings to extract transactions
   * @param data The parsed CSV data
   * @returns The first successful set of transactions found, or an empty array if all fail
   */
  private iterateFormatMappings(data: ParsedData): Transaction[] {
    console.log('Attempting to extract transactions with alternative format mappings');
    
    // Try each mapping except the one already tried
    for (const [formatKey, mapping] of Object.entries(this.bankMappings)) {
      if (formatKey === data.detectedFormat) {
        continue; // Skip the already tried format
      }
      
      console.log(`Trying format mapping: ${formatKey}`);
      const transactions = this.applyMapping(data, mapping);
      
      // If we found some transactions, return them
      if (transactions.length > 0) {
        console.log(`Successfully extracted ${transactions.length} transactions using ${formatKey} mapping`);
        return transactions;
      }
    }
    
    console.warn('Failed to extract transactions with any available format mapping');
    return [];
  }

  /**
   * Apply a mapping to transform parsed data into transactions
   */
  private applyMapping(data: ParsedData, mapping: TransactionMapping): Transaction[] {
    const { headers, rows } = data;
    const transactions: Transaction[] = [];

    console.log('Applying mapping for format:', data.detectedFormat);
    console.log('Using mapping:', mapping);

    // Special case for ICICI Credit Card statements which have a unique structure
    if (data.detectedFormat === 'ICICI_CC') {
      console.log('Using special ICICI Credit Card mapping logic');
      return this.mapICICICreditCardTransactions(data);
    }

    // Create a map of header indices for quick lookup
    const headerIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      headerIndices[header.trim()] = index;
    });

    // Check if required columns exist
    const dateIndex = this.findColumnIndex(headerIndices, mapping.dateColumn);
    const payeeIndex = this.findColumnIndex(headerIndices, mapping.payeeColumn);
    
    if (dateIndex === -1 || payeeIndex === -1) {
      console.error('Required columns not found in CSV data');
      console.error('Headers:', headers);
      console.error('Looking for date column:', mapping.dateColumn, 'and payee column:', mapping.payeeColumn);
      return [];
    }

    // Find indices for other columns
    const memoIndex = mapping.memoColumn ? this.findColumnIndex(headerIndices, mapping.memoColumn) : -1;
    const amountIndex = mapping.amountColumn ? this.findColumnIndex(headerIndices, mapping.amountColumn) : -1;
    const inflowIndex = mapping.inflowColumn ? this.findColumnIndex(headerIndices, mapping.inflowColumn) : -1;
    const outflowIndex = mapping.outflowColumn ? this.findColumnIndex(headerIndices, mapping.outflowColumn) : -1;
    
    console.log('Column indices found:', {
      date: dateIndex,
      payee: payeeIndex,
      memo: memoIndex,
      amount: amountIndex,
      inflow: inflowIndex,
      outflow: outflowIndex
    });

    // Process each row
    for (const row of rows) {
      try {
        // Skip rows that don't have enough values
        if (row.length <= Math.max(dateIndex, payeeIndex)) {
          console.warn('Skipping row with insufficient data:', row);
          continue;
        }

        // Extract date and format it to YYYY-MM-DD for internal processing, then to DD/MM/YYYY for YNAB
        const dateValue = row[dateIndex];
        const parsedDate = this.parseDate(dateValue, mapping.dateFormat);
        if (!parsedDate) {
          console.warn(`Skipping row with invalid date: ${dateValue}`);
          continue;
        }
        
        // Format date in YNAB expected format (DD/MM/YYYY)
        const ynabDate = this.formatDateForYNAB(parsedDate);

        // Extract payee, memo, inflow and outflow
        let payee = '';
        let memo = '';
        let inflow = 0;
        let outflow = 0;

        // Special handling for Axis Bank statements
        if (data.detectedFormat === 'Axis_Bank') {
          // Get the particulars field for transaction description
          const particulars = row[payeeIndex] ? row[payeeIndex].toString().trim() : '';
          
          // Save full description as memo
          memo = particulars;
          
          // Extract a meaningful payee name from the description
          payee = this.extractAxisBankPayee(particulars);
          
          // Process the inflow and outflow amounts
          const amounts = this.extractAxisBankAmounts(row, inflowIndex, outflowIndex);
          inflow = amounts.inflow;
          outflow = amounts.outflow;
          
          // Add extra validation to ensure we don't have both inflow and outflow for the same transaction
          if (inflow > 0 && outflow > 0) {
            console.warn('Transaction has both inflow and outflow, keeping the larger value', { inflow, outflow });
            if (inflow >= outflow) {
              outflow = 0;
            } else {
              inflow = 0;
            }
          }
          
          console.log('Extracted transaction details:', { 
            date: ynabDate, payee, memo, inflow, outflow
          });
        }
        else {
          // Standard handling for other bank statements
          payee = this.sanitizePayee(row[payeeIndex] || 'Unknown');
          memo = memoIndex !== -1 ? this.sanitizeMemo(row[memoIndex] || '') : '';
            if (amountIndex !== -1) {
            // Single amount column
            const amountStr = this.cleanAmount(row[amountIndex], mapping.numberFormat);
            const amount = parseFloat(amountStr);
            
            if (!isNaN(amount)) {
              if (mapping.invertAmount) {
                // For credit cards where positive means money spent
                if (amount > 0) {
                  outflow = amount;
                } else {
                  inflow = Math.abs(amount);
                }
              } else {
                // Normal case
                if (amount < 0) {
                  outflow = Math.abs(amount);
                } else {
                  inflow = amount;
                }
              }
            }
          } else if (inflowIndex !== -1 && outflowIndex !== -1) {
            // Separate inflow/outflow columns
            const inflowStr = this.cleanAmount(row[inflowIndex], mapping.numberFormat);
            const outflowStr = this.cleanAmount(row[outflowIndex], mapping.numberFormat);
            
            inflow = parseFloat(inflowStr) || 0;
            outflow = parseFloat(outflowStr) || 0;
          }
        }

        // Round amounts to 2 decimal places
        inflow = this.roundToTwoDecimals(inflow);
        outflow = this.roundToTwoDecimals(outflow);

        // Create transaction object
        const transaction: Transaction = {
          date: ynabDate,
          payee,
          memo,
          inflow,
          outflow,
          account: ''     // Not used for YNAB import
        };

        transactions.push(transaction);
      } catch (error) {
        console.error('Error processing row:', row, error);
      }
    }

    console.log(`Successfully processed ${transactions.length} transactions`);
    return transactions;
  }
  
  /**
   * Specialized method to map ICICI Credit Card transactions
   */
  private mapICICICreditCardTransactions(data: ParsedData): Transaction[] {
    console.log('Processing ICICI Credit Card transactions with specialized mapper');
    const { headers, rows, fileName } = data;
    const transactions: Transaction[] = [];
    
    // Determine column indices from the headers
    let dateColumnIndex = -1;
    let detailsColumnIndex = -1;
    let amountColumnIndex = -1;
    let referenceColumnIndex = -1;
    
    // Find the indices of required columns
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      if (headerLower === 'transaction date') {
        dateColumnIndex = index;
      } else if (headerLower === 'details') {
        detailsColumnIndex = index;
      } else if (headerLower === 'amount (inr)') {
        amountColumnIndex = index;
      } else if (headerLower === 'reference number') {
        referenceColumnIndex = index;
      }
    });
    
    // Use default positions if we couldn't find them by header name
    if (dateColumnIndex === -1) dateColumnIndex = 2;
    if (detailsColumnIndex === -1) detailsColumnIndex = 3;
    if (amountColumnIndex === -1) amountColumnIndex = fileName.toLowerCase().includes('last') ? 6 : 5;
    if (referenceColumnIndex === -1) referenceColumnIndex = fileName.toLowerCase().includes('last') ? 9 : 7;
    
    console.log('Using column indices:', { 
      date: dateColumnIndex,
      details: detailsColumnIndex,
      amount: amountColumnIndex,
      reference: referenceColumnIndex
    });
    
    for (const row of rows) {
      try {
        // Skip rows that don't have enough columns
        if (!row || row.length <= Math.max(dateColumnIndex, amountColumnIndex, detailsColumnIndex)) {
          console.warn('Skipping row with insufficient data:', row);
          continue;
        }
        
        const dateValue = row[dateColumnIndex]; // Transaction Date
        const details = row[detailsColumnIndex]; // Details
        const amountValue = row[amountColumnIndex]; // Amount (INR)
        
        // Try to get reference number if available
        const referenceNo = row.length > referenceColumnIndex ? row[referenceColumnIndex] || '' : '';
        
        // Skip rows without date or amount
        if (!dateValue || !amountValue) {
          console.warn('Skipping row without date or amount:', row);
          continue;
        }
        
        // Parse the date
        const parsedDate = this.parseDate(dateValue, 'DD/MM/YYYY');
        if (!parsedDate) {
          console.warn(`Skipping row with invalid date: ${dateValue}`);
          continue;
        }
        
        // Format date in YNAB expected format
        const ynabDate = this.formatDateForYNAB(parsedDate);
        
        // Extract payee from details
        const payee = this.sanitizePayee(this.extractICICICCPayee(details || ''));
        
        // Use reference number as memo
        const memo = this.sanitizeMemo(referenceNo ? `Ref: ${referenceNo}` : '');
        
        // Parse amount - handle Dr. (outflow) and Cr. (inflow) indicators
        let inflow = 0;
        let outflow = 0;
        
        console.log(`Processing amount value: "${amountValue}"`);
        
        if (amountValue) {
          const amountStr = amountValue.toString().trim();
          const isDr = amountStr.includes('Dr.'); // Debit (outflow)
          const isCr = amountStr.includes('Cr.'); // Credit (inflow)
          
          // Clean amount by removing Dr./Cr. and commas
          const cleanedAmount = amountStr
            .replace(/Dr\./g, '')
            .replace(/Cr\./g, '')
            .replace(/,/g, '')
            .replace(/[^\d.]/g, '')
            .trim();
          
          console.log(`Extracted amount: "${cleanedAmount}" (isDr: ${isDr}, isCr: ${isCr})`);
          
          const amount = parseFloat(cleanedAmount);
          
          if (!isNaN(amount)) {
            if (isDr) {
              outflow = this.roundToTwoDecimals(amount);
              console.log(`Setting outflow to ${outflow}`);
            } else if (isCr) {
              inflow = this.roundToTwoDecimals(amount);
              console.log(`Setting inflow to ${inflow}`);
            } else {
              // If no indicator, assume outflow for credit card
              outflow = this.roundToTwoDecimals(amount);
              console.log(`No indicator, defaulting outflow to ${outflow}`);
            }
          }
        }
        
        const transaction: Transaction = {
          date: ynabDate,
          payee,
          memo,
          inflow,
          outflow,
          account: ''
        };
        
        console.log('Processed ICICI CC transaction:', transaction);
        transactions.push(transaction);
        
      } catch (error) {
        console.error('Error processing ICICI Credit Card row:', row, error);
      }
    }
    
    console.log(`Successfully processed ${transactions.length} ICICI Credit Card transactions`);
    return transactions;
  }

  /**
   * Find the index of a column by name with some flexibility
   */
  private findColumnIndex(headerIndices: Record<string, number>, columnName: string): number {
    console.log(`Looking for column: ${columnName} in headers`, headerIndices);
    
    // Try exact match first
    if (headerIndices[columnName] !== undefined) {
      console.log(`Found exact match for ${columnName} at index ${headerIndices[columnName]}`);
      return headerIndices[columnName];
    }

    // Try case-insensitive match
    const lowerColumnName = columnName.toLowerCase();
    for (const [header, index] of Object.entries(headerIndices)) {
      if (header.toLowerCase() === lowerColumnName) {
        console.log(`Found case-insensitive match for ${columnName}: ${header} at index ${index}`);
        return index;
      }
    }

    // Try partial match
    for (const [header, index] of Object.entries(headerIndices)) {
      if (header.toLowerCase().includes(lowerColumnName) || 
          lowerColumnName.includes(header.toLowerCase())) {
        console.log(`Found partial match for ${columnName}: ${header} at index ${index}`);
        return index;
      }
    }
    
    // Try common aliases for typical columns
    const aliases: Record<string, string[]> = {
      'Tran Date': ['date', 'transaction date', 'txn date', 'trans date', 'value date'],
      'Particulars': ['description', 'narration', 'details', 'remarks', 'transaction details'],
      'Withdrawal Amt': ['debit', 'debit amount', 'dr', 'withdrawal', 'payment'],
      'Deposit Amt': ['credit', 'credit amount', 'cr', 'deposit', 'receipt'],
      'Chq/Ref No': ['reference', 'ref no', 'ref number', 'ref.no', 'cheque no', 'chq no']
    };
    
    // Check if the column name has aliases, and try to find them
    const possibleAliases = Object.entries(aliases).find(([key]) => 
      key.toLowerCase() === lowerColumnName || key.toLowerCase().includes(lowerColumnName)
    );
    
    if (possibleAliases) {
      const [originalName, aliasList] = possibleAliases;
      for (const alias of aliasList) {
        for (const [header, index] of Object.entries(headerIndices)) {
          if (header.toLowerCase().includes(alias)) {
            console.log(`Found alias match for ${columnName} using ${alias}: ${header} at index ${index}`);
            return index;
          }
        }
      }
    }

    console.log(`No match found for column: ${columnName}`);
    return -1;
  }

  /**
   * Clean amount string by removing currency symbols and commas
   */  private cleanAmount(value: any, formatOptions?: TransactionMapping['numberFormat']): string {
    if (!value) return '0';
    
    // First trim any whitespace
    let trimmed = value.toString();
    
    // Apply special trimming for some bank formats that have excessive spaces
    if (formatOptions?.trimSpaces) {
      trimmed = trimmed.replace(/\s+/g, ' ').trim();
    } else {
      trimmed = trimmed.trim();
    }
    
    console.log(`Processing amount value: "${trimmed}"`);
    
    // Check for Dr. and Cr. indicators in ICICI credit card format
    const isDr = trimmed.includes('Dr.');
    const isCr = trimmed.includes('Cr.');
    
    // Get the appropriate thousand separator and decimal separator
    const thousandsSeparator = formatOptions?.thousandsSeparator || ',';
    const decimalSeparator = formatOptions?.decimalSeparator || '.';
    
    // Remove currency symbols (₹, Rs., INR), commas, 'Dr.' and 'Cr.' indicators
    let cleaned = trimmed
      .replace(/Dr\./g, '')
      .replace(/Cr\./g, '')
      .replace(/₹/g, '')
      .replace(/Rs\./g, '')
      .replace(/INR/g, '')
      .replace(new RegExp(thousandsSeparator, 'g'), '')
      .replace(/[^\d.-]/g, '');
      
    // If decimal separator is not a period, replace it with a period
    if (decimalSeparator !== '.' && trimmed.includes(decimalSeparator)) {
      cleaned = cleaned.replace(decimalSeparator, '.');
    }
    
    // Apply credit/debit indicators
    if (isDr) {
      // Make sure it's negative for Dr. (debit/outflow)
      if (!cleaned.startsWith('-')) {
        cleaned = `-${cleaned}`;
      }
    } else if (isCr) {
      // Make sure it's positive for Cr. (credit/inflow)
      if (cleaned.startsWith('-')) {
        cleaned = cleaned.substring(1);
      }
    }
    
    console.log(`Cleaned amount: "${value}" -> "${cleaned}" (isDr: ${isDr}, isCr: ${isCr})`);
    
    // Handle special case for blank or invalid amount
    if (!cleaned || cleaned === '-' || cleaned === '.') {
      return '0';
    }
    
    return cleaned;
  }

  /**
   * Parse a date string into YYYY-MM-DD format
   */
  private parseDate(dateStr: string, format: string): string | null {
    try {
      if (!dateStr) {
        return null;
      }
      
      // Clean up the date string
      const cleanDateStr = dateStr.toString().trim().replace(/\s+/g, ' ');
      
      // Different date formats to try
      if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY') {
        // Parse DD/MM/YYYY format
        const match = cleanDateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (match) {
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          let year = match[3];
          
          // Handle 2-digit years
          if (year.length === 2) {
            const currentYear = new Date().getFullYear();
            const century = Math.floor(currentYear / 100);
            const twoDigitYear = parseInt(year, 10);
            
            // Assume dates within 20 years in the future or 80 years in the past
            if (twoDigitYear > (currentYear % 100) + 20) {
              year = `${century - 1}${year}`;
            } else {
              year = `${century}${year}`;
            }
          }
          
          return `${year}-${month}-${day}`;
        }
      } else if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
        // Parse MM/DD/YYYY format
        const match = cleanDateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (match) {
          const month = match[1].padStart(2, '0');
          const day = match[2].padStart(2, '0');
          let year = match[3];
          
          // Handle 2-digit years
          if (year.length === 2) {
            const currentYear = new Date().getFullYear();
            const century = Math.floor(currentYear / 100);
            const twoDigitYear = parseInt(year, 10);
            
            if (twoDigitYear > (currentYear % 100) + 20) {
              year = `${century - 1}${year}`;
            } else {
              year = `${century}${year}`;
            }
          }
          
          return `${year}-${month}-${day}`;
        }
      } else if (format === 'YYYY-MM-DD' || format === 'YYYY/MM/DD') {
        // Parse ISO format
        const match = cleanDateStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
        if (match) {
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      // Try additional date formats (e.g., "01 Apr 2025")
      const monthNameMatch = cleanDateStr.match(/(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{4})/);
      if (monthNameMatch) {
        const day = monthNameMatch[1].padStart(2, '0');
        const monthName = monthNameMatch[2].toLowerCase();
        const year = monthNameMatch[3];
        
        const months: {[key: string]: string} = {
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
          'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
          'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        
        if (months[monthName]) {
          return `${year}-${months[monthName]}-${day}`;
        }
      }
      
      // Fallback: Try to parse with Date object
      const date = new Date(cleanDateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      console.error(`Failed to parse date: ${dateStr} with format ${format}`);
      return null;
    } catch (error) {
      console.error(`Error parsing date: ${dateStr}`, error);
      return null;
    }
  }

  /**
   * Format a date string from YYYY-MM-DD to DD/MM/YYYY (YNAB format)
   */
  private formatDateForYNAB(isoDate: string): string {
    if (!isoDate) return '';
    
    try {
      // Parse ISO date (YYYY-MM-DD)
      const [year, month, day] = isoDate.split('-');
      
      // Return in DD/MM/YYYY format for YNAB
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error(`Error formatting date for YNAB: ${isoDate}`, error);
      return isoDate; // Return original if there's an error
    }
  }

  /**
   * Round a number to two decimal places (for currency)
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Sanitize payee field to handle special characters
   */
  private sanitizePayee(payee: string): string {
    if (!payee) return 'Unknown';
    
    // Replace problematic characters with safe alternatives
    let sanitized = payee
      .replace(/[^\w\s.,\-&@()]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ')            // Collapse multiple spaces
      .trim();
    
    // Truncate if too long (YNAB has limits)
    return sanitized.length > 100 ? sanitized.substring(0, 97) + '...' : sanitized;
  }

  /**
   * Sanitize memo field to handle special characters
   */
  private sanitizeMemo(memo: string): string {
    if (!memo) return '';
    
    // Replace problematic characters with safe alternatives
    let sanitized = memo
      .replace(/[^\w\s.,\-&@()]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ')            // Collapse multiple spaces
      .trim();
    
    // Truncate if too long (YNAB has limits)
    return sanitized.length > 200 ? sanitized.substring(0, 197) + '...' : sanitized;
  }

  /**
   * Extract a meaningful payee name from Axis Bank transaction description
   */
  private extractAxisBankPayee(particulars: string): string {
    if (!particulars) {
      return 'Unknown';
    }
    
    // Handle IMPS transactions - check this case first as it appears in screenshot
    if (particulars.includes('IMPS')) {
      // For IMPS transactions with format "IMPS/P2A/511619321843/SHUBHANG/ICICIBANK/IMPSTran/919881729986922978"
      // Extract SHUBHANG (4th part)
      const impsSlashParts = particulars.split('/');
      if (impsSlashParts.length >= 4) {
        // Try to get the 4th segment which often contains the actual name
        return impsSlashParts[3].trim();
      }
      
      // For other IMPS formats
      const impsPatterns = [
        /IMPS\/\w+\/\d+\/([^\/]+)/i,  // Matches "IMPS/P2A/511619321843/SHUBHANG/..."
        /IMPS-(\w+)-([^-\/]+)/i,
        /IMPS[\/\s]([^\/\s]+)/i,
        /IMPS-[^\/]+-([^\/]+)/i
      ];
      
      for (const pattern of impsPatterns) {
        const match = particulars.match(pattern);
        if (match && match[1] && match[1].length > 1) {
          const captured = match[1].trim();
          if (!/^\d+$/.test(captured)) {
            return captured;
          }
        }
      }
      
      return 'IMPS Transfer';
    }
    
    // Handle NBSM format for DREAMPLUG TECHNOLOGIES etc.
    if (particulars.includes('NBSM')) {
      const nbsmParts = particulars.split('/');
      if (nbsmParts.length >= 3) {
        // Return the part after the transaction number which is typically the payee name
        return nbsmParts[2].trim();
      }
    }
    
    // Handle UPI transactions
    if (particulars.includes('UPI')) {
      // Extract the payee name from UPI string format (especially for Axis Bank)
      // For transactions like "UPI-545515394479-SHUBHANG" or "UPI-545556998922-DREAMPLUG TECHNOLOGIES PVT LTD"
      const payeePattern = /UPI-\d+-(.+)/i;
      const match = particulars.match(payeePattern);
      if (match && match[1]) {
        return match[1].trim();
      }
      
      // If the above pattern didn't work, try other patterns
      const upiPatterns = [
        /UPI[\/\s]([^\/\s]+)/i,
        /UPI-[^\/]+-([^\/]+)/i,
        /TO\s+([^\/\s]+)/i
      ];
      
      for (const pattern of upiPatterns) {
        const match = particulars.match(pattern);
        if (match && match[1] && match[1].length > 1) {
          // Only avoid purely numeric transaction IDs, keep all other identifiers
          const captured = match[1].trim();
          if (!/^\d+$/.test(captured)) {
            return captured;
          }
        }
      }
      
      // If patterns didn't work, try splitting by slashes and picking a meaningful part
      const parts = particulars.split('/');
      for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned && cleaned.length > 1 && !/^\d+$/.test(cleaned)) {
          return cleaned;
        }
      }
      
      return 'UPI Payment';
    }
    
    // For other transactions, use the first meaningful part of the description
    const parts = particulars.split(/[\/\-\s]+/);
    for (const part of parts) {
      const cleaned = part.trim();
      if (cleaned && cleaned.length > 2 && 
          !/^\d+$/.test(cleaned) && 
          !['REF', 'TRN', 'TO', 'BY', 'ON', 'FOR'].includes(cleaned.toUpperCase())) {
        return cleaned;
      }
    }
    
    return particulars.length > 30 ? particulars.substring(0, 30) + '...' : particulars;
  }

  /**
   * Extract a meaningful payee name from ICICI Credit Card transaction description
   */
  private extractICICICCPayee(details: string): string {
    if (!details) {
      return 'Unknown';
    }
    
    console.log(`Extracting payee from ICICI CC details: "${details}"`);
    
    // Handle UPI transactions (common in ICICI CC statements)
    if (details.includes('UPI-')) {
      // For format: "UPI-545515394479_UPI-545515394479-SAI FLOW"
      if (details.includes('_')) {
        const underscoreSplit = details.split('_');
        if (underscoreSplit.length >= 2) {
          const secondPart = underscoreSplit[1];
          // Look for third segment in the second part (after UPI-number-)
          const match = secondPart.match(/UPI-\d+-(.+)/i);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
      
      // For simpler format: "UPI-545556998922-YADAV SA"
      const simpleMatch = details.match(/UPI-\d+-(.+)/i);
      if (simpleMatch && simpleMatch[1]) {
        return simpleMatch[1].trim();
      }
    }
    
    // For merchant transactions like "AMAZON PAY INDIA PRIVA, wwwamazonin, IND"
    if (details.includes(',')) {
      // Take the first part before the comma which is usually the merchant name
      return details.split(',')[0].trim();
    }
    
    // Default case: return the whole description if it's not too long
    return details.length > 30 ? details.substring(0, 30) + '...' : details;
  }

  /**
   * Extract inflow and outflow amounts from Axis Bank statement row
   */  private extractAxisBankAmounts(row: any[], inflowIndex: number, outflowIndex: number): { inflow: number, outflow: number } {
    let inflow = 0;
    let outflow = 0;
    
    const numberFormat = this.bankMappings['Axis_Bank'].numberFormat;
    
    if (inflowIndex !== -1) {
      const inflowStr = this.cleanAmount(row[inflowIndex], numberFormat);
      inflow = parseFloat(inflowStr) || 0;
    }
    
    if (outflowIndex !== -1) {
      const outflowStr = this.cleanAmount(row[outflowIndex], numberFormat);
      outflow = parseFloat(outflowStr) || 0;
    }
    
    return { inflow, outflow };
  }
}