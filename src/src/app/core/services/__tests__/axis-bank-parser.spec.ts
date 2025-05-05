import { TestBed } from '@angular/core/testing';
import { CsvParserService, ParsedData } from '../csv-parser.service';
import { TransactionMapperService } from '../transaction-mapper.service';

describe('Axis Bank CSV Parsing Tests', () => {
  let csvParserService: CsvParserService;
  let transactionMapperService: TransactionMapperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    csvParserService = TestBed.inject(CsvParserService);
    transactionMapperService = TestBed.inject(TransactionMapperService);
  });

  it('should parse Axis Bank statement with whitespace in amount columns', async () => {
    // Create a mock File object with Axis Bank statement content
    const content = `Name :- SAURABH VIKAS GADKARI (HUF)
Joint Holder :- -
FLAT NO B 602 WOODSVILLE PHASE 2 NEAR
Customer ID :- 948377135
IFSC Code :- UTIB0004875
MICR Code :- 411211079

Statement of Account No - 923010008070086 for the period (From : 16-03-2025 To : 04-05-2025)

Tran Date,CHQNO,PARTICULARS,DR,CR,BAL,SOL
16-03-2025,-,NBSM/96863804/CRED(RAZORPAY)/,              4439.59, ,           604111.30,4875
31-03-2025,-,SB:923010008070086:Int.Pd:01-01-2025 to 31-03-2025, ,              4538.00,           608649.30,4875
06-04-2025,-,NBSM/99489067/CRED(RAZORPAY)/,             22584.90, ,           586064.40,4875
21-04-2025,-,IMPS/P2A/511110688643/SHUBHANG/ICICIBAN/IMPSTran/9198817299869229798, ,            200000.00,           786064.40,4875
26-04-2025,-,IMPS/P2A/511619321843/SHUBHANG/ICICIBAN/IMPSTran/9198817299869229798, ,            367000.00,          1153064.40,4875
02-05-2025,-,NBSM/102638216/DREAMPLUG TECHNOLOGIES PVT LTD (PA,             62995.63, ,          1090068.77,4875

"Unless the constituent notifies the bank immediately of any discrepancy found by him/her in this statement of Account, it will be taken that he/she has found the account correct. "
    `;

    const file = new File([content], 'Axis 086 account.csv', { type: 'text/csv' });
    
    // Create a spy for readFileContent to return our mock content
    spyOn<any>(csvParserService, 'readFileContent').and.returnValue(Promise.resolve(content));
    
    // Parse the file
    const result = await csvParserService.parseFile(file);
    
    // Verify the basic parsing results
    expect(result).toBeTruthy();
    expect(result.detectedFormat).toBe('Axis_Bank');
    expect(result.headers).toContain('Tran Date');
    expect(result.headers).toContain('PARTICULARS');
    expect(result.headers).toContain('DR');
    expect(result.headers).toContain('CR');
    
    // Verify that we have the expected number of transaction rows
    expect(result.rows.length).toBe(6);
    
    // Verify that the whitespace in amount columns is properly handled
    expect(result.rows[0][3].trim()).toBe('4439.59');
    
    // Map to transactions
    const transactions = transactionMapperService.mapToTransactions(result);
    
    // Verify we got the right number of transactions
    expect(transactions.length).toBe(6);
    
    // Check specific transaction details
    const firstTransaction = transactions[0];
    expect(firstTransaction.date).toBe('2025-03-16');
    expect(firstTransaction.payee).toBe('NBSM/96863804/CRED(RAZORPAY)/');
    expect(firstTransaction.outflow).toBe(4439.59);
    expect(firstTransaction.inflow).toBe(0);
    
    // Check a transaction with inflow
    const secondTransaction = transactions[1];
    expect(secondTransaction.date).toBe('2025-03-31');
    expect(secondTransaction.inflow).toBe(4538);
    expect(secondTransaction.outflow).toBe(0);
  });
});
