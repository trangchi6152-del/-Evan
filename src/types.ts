export interface FundData {
  principal: number;
  currentValue: number;
}

export interface AppState {
  onExchange: FundData;
  offExchange: FundData;
  targetAmount: number;
  history?: Array<{ date: string; totalValue: number }>;
}
