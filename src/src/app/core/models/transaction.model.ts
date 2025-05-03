/**
 * Represents a transaction in YNAB-compatible format
 */
export interface Transaction {
  date: string;         // In YYYY-MM-DD format (YNAB format)
  payee: string;        // Description of the transaction
  memo: string;         // Additional details
  outflow: number;      // Amount spent (positive number)
  inflow: number;       // Amount received (positive number)
  account?: string;     // Account name (optional for multi-account support)
}

/**
 * Configuration for mapping source file columns to YNAB fields
 */
export interface TransactionMapping {
  dateColumn: string;
  payeeColumn: string;
  memoColumn?: string;
  amountColumn?: string;  // Used if there's a single amount column
  inflowColumn?: string;  // Used if inflow/outflow are separate columns
  outflowColumn?: string; // Used if inflow/outflow are separate columns
  accountColumn?: string;
  dateFormat: string;     // The format of the date in the source file
  invertAmount?: boolean; // Whether to invert the amount (some statements use negative for debits)
}