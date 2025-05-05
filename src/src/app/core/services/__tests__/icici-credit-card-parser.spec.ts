import { TestBed } from '@angular/core/testing';
import { CsvParserService } from '../csv-parser.service';
import { TransactionMapperService } from '../transaction-mapper.service';

describe('ICICI Credit Card CSV Parsing Tests', () => {
  let csvParserService: CsvParserService;
  let transactionMapperService: TransactionMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    csvParserService = TestBed.inject(CsvParserService);
    transactionMapperService = TestBed.inject(TransactionMapperService);
  });

  it('should be created', () => {
    expect(csvParserService).toBeTruthy();
    expect(transactionMapperService).toBeTruthy();
  });

  it('should process ICICI Credit Card format directly', () => {
    // Create mock data that matches the format expected by the mapper
    const parsedData = {
      headers: ['Transaction Date', 'Details', 'Amount (INR)'],
      rows: [
        ['01/04/2023', 'AMAZON PURCHASE', '2500.00 Dr.'],
        ['05/04/2023', 'RESTAURANT PAYMENT', '1500.00 Dr.'],
        ['10/04/2023', 'PAYMENT RECEIVED', '5000.00 Cr.']
      ],
      fileName: 'ICICI_Credit_Card_Statement.csv',
      detectedFormat: 'ICICI_CC'
    };
    
    // Map to transactions directly without parsing
    const transactions = transactionMapperService.mapToTransactions(parsedData);
    
    // Verify transaction mapping works correctly
    expect(transactions.length).toBe(3);
    
    // Check first transaction (outflow)
    expect(transactions[0].date).toBe('01/04/2023');
    expect(transactions[0].payee).toBe('AMAZON PURCHASE');
    expect(transactions[0].outflow).toBe(2500);
    expect(transactions[0].inflow).toBe(0);
    
    // Check third transaction (inflow)
    expect(transactions[2].date).toBe('10/04/2023');
    expect(transactions[2].payee).toBe('PAYMENT RECEIVED');
    expect(transactions[2].inflow).toBe(5000);
    expect(transactions[2].outflow).toBe(0);
  });
});
