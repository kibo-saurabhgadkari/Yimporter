import { TestBed } from '@angular/core/testing';
import { TransactionMapperService } from '../transaction-mapper.service';
import { ParsedData } from '../csv-parser.service';

describe('TransactionMapperService', () => {
  let service: TransactionMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TransactionMapperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should map ICICI Bank statement data to transactions', () => {
    // Mock ICICI Bank statement data
    const parsedData: ParsedData = {
      headers: ['Transaction Date', 'Value Date', 'Description', 'Reference Number', 'Deposit Amount', 'Withdrawal Amount', 'Balance'],
      rows: [
        ['01/04/2023', '01/04/2023', 'SALARY CREDIT', 'REF001', '50000.00', '', '150000.00'],
        ['05/04/2023', '05/04/2023', 'ATM WITHDRAWAL', 'REF002', '', '10000.00', '140000.00'],
        ['10/04/2023', '10/04/2023', 'ONLINE PURCHASE - AMAZON', 'REF003', '', '5000.00', '135000.00']
      ],
      fileName: 'ICICI_Bank_Statement.csv',
      detectedFormat: 'ICICI_Bank'
    };

    const transactions = service.mapToTransactions(parsedData);

    expect(transactions.length).toBe(3);
    
    // Check inflow transaction
    expect(transactions[0].date).toBe('2023-04-01');
    expect(transactions[0].payee).toBe('SALARY CREDIT');
    expect(transactions[0].memo).toBe('REF001');
    expect(transactions[0].inflow).toBe(50000);
    expect(transactions[0].outflow).toBe(0);

    // Check outflow transaction
    expect(transactions[1].date).toBe('2023-04-05');
    expect(transactions[1].payee).toBe('ATM WITHDRAWAL');
    expect(transactions[1].memo).toBe('REF002');
    expect(transactions[1].inflow).toBe(0);
    expect(transactions[1].outflow).toBe(10000);
  });

  it('should handle credit card statement with amount inversion', () => {
    // Mock ICICI Credit Card statement data
    const parsedData: ParsedData = {
      headers: ['Transaction Date', 'Description', 'Amount'],
      rows: [
        ['01/04/2023', 'AMAZON PURCHASE', '2500.00'],
        ['05/04/2023', 'RESTAURANT PAYMENT', '1500.00'],
        ['10/04/2023', 'PAYMENT RECEIVED', '-5000.00']
      ],
      fileName: 'ICICI_Credit_Card_Statement.csv',
      detectedFormat: 'ICICI_CC'
    };

    const transactions = service.mapToTransactions(parsedData);

    expect(transactions.length).toBe(3);
    
    // Check outflow transaction (positive amount in CC statement = expense)
    expect(transactions[0].date).toBe('2023-04-01');
    expect(transactions[0].payee).toBe('AMAZON PURCHASE');
    expect(transactions[0].outflow).toBe(2500);
    expect(transactions[0].inflow).toBe(0);

    // Check inflow transaction (negative amount in CC statement = payment)
    expect(transactions[2].date).toBe('2023-04-10');
    expect(transactions[2].payee).toBe('PAYMENT RECEIVED');
    expect(transactions[2].inflow).toBe(5000);
    expect(transactions[2].outflow).toBe(0);
  });

  it('should handle different date formats correctly', () => {
    // Mock Axis Bank statement with DD-MM-YYYY format
    const parsedData: ParsedData = {
      headers: ['Tran Date', 'Particulars', 'Chq/Ref No', 'Withdrawal Amt', 'Deposit Amt', 'Balance'],
      rows: [
        ['15-04-2023', 'UTILITY PAYMENT', 'REF123', '2000.00', '', '48000.00'],
        ['20-04-2023', 'INTEREST CREDIT', 'INT456', '', '500.00', '48500.00']
      ],
      fileName: 'Axis_Bank_Statement.csv',
      detectedFormat: 'Axis_Bank'
    };

    const transactions = service.mapToTransactions(parsedData);

    expect(transactions.length).toBe(2);
    
    // Check that dates are formatted correctly to YYYY-MM-DD
    expect(transactions[0].date).toBe('2023-04-15');
    expect(transactions[1].date).toBe('2023-04-20');
  });
});