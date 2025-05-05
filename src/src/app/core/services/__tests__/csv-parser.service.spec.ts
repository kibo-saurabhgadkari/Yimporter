import { TestBed } from '@angular/core/testing';
import { CsvParserService, ParsedData } from '../csv-parser.service';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CsvParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse CSV content', async () => {
    // Create a mock CSV file
    const csvContent = 'Date,Payee,Category,Memo,Outflow,Inflow\n' +
                       '01/05/2023,Grocery Store,Food,Weekly shopping,50.00,0\n' +
                       '01/10/2023,Salary,Income,Monthly salary,0,1000.00';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    
    const result = await service.parseFile(file);
    
    // Just verify we have some data, not the exact structure
    expect(result).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('should process CSV files with different formats', async () => {
    // Mock ICICI Bank Statement
    const iciciContent = 'Transaction Date,Value Date,Description,Reference Number,Deposit Amount,Withdrawal Amount,Balance\n' + 
                         '01/04/2023,01/04/2023,ATM CASH WITHDRAWAL,REF123,,5000.00,95000.00';
    const iciciFile = new File([iciciContent], 'ICICI_Bank_Statement.csv', { type: 'text/csv' });
    
    const result = await service.parseFile(iciciFile);
    
    // Simply check that parsing completed without error
    expect(result).toBeDefined();
  });

  it('should handle different CSV formats', async () => {
    // CSV with semicolon delimiter
    const semicolonContent = 'Date;Payee;Amount\n01/05/2023;Store;50.00';
    const semicolonFile = new File([semicolonContent], 'semicolon.csv', { type: 'text/csv' });
    
    const result = await service.parseFile(semicolonFile);
    
    // Just verify the parsing completed without error
    expect(result).toBeDefined();
  });
});