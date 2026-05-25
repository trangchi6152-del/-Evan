import { useState, useMemo, useEffect } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { AppState } from "./types";
import { Card } from "./components/Card";
import { StatCard } from "./components/StatCard";
import { Input } from "./components/Input";
import { formatCurrency, formatPercent } from "./lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { LayoutDashboard, Target, Activity, Moon, Sun, TrendingUp, Plus } from "lucide-react";
import { motion } from "motion/react";

const INITIAL_STATE: AppState = {
  onExchange: { principal: 10000, currentValue: 12000 },
  offExchange: { principal: 20000, currentValue: 21000 },
  targetAmount: 100000,
};

export default function App() {
  const [state, setState] = useLocalStorage<AppState>("nasdaq-accounting-data", INITIAL_STATE);
  const [isDark, setIsDark] = useLocalStorage<boolean>("nasdaq-theme-dark", true);
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Derived calculations
  const totalPrincipal = state.onExchange.principal + state.offExchange.principal;
  const totalCurrentValue = state.onExchange.currentValue + state.offExchange.currentValue;
  const totalPL = totalCurrentValue - totalPrincipal;
  const totalPLPercent = totalPrincipal > 0 ? totalPL / totalPrincipal : 0;

  const onExchangePL = state.onExchange.currentValue - state.onExchange.principal;
  const onExchangePLPercent = state.onExchange.principal > 0 ? onExchangePL / state.onExchange.principal : 0;

  const offExchangePL = state.offExchange.currentValue - state.offExchange.principal;
  const offExchangePLPercent = state.offExchange.principal > 0 ? offExchangePL / state.offExchange.principal : 0;

  const targetProgress = state.targetAmount > 0 ? totalCurrentValue / state.targetAmount : 0;

  // Handlers
  const handleUpdate = (field: keyof AppState, subField: "principal" | "currentValue", value: string) => {
    const numValue = parseFloat(value) || 0;
    setState((prev: AppState) => ({
      ...prev,
      [field]: {
        ...prev[field as "onExchange" | "offExchange"],
        [subField]: numValue,
      },
    }));
  };

  const handleTargetUpdate = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setState((prev: AppState) => ({
      ...prev,
      targetAmount: numValue,
    }));
  };

  const handleRecordData = () => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const newTotal = state.onExchange.currentValue + state.offExchange.currentValue;
    
    setState((prev) => {
      const history = prev.history || [];
      const existingIndex = history.findIndex(h => h.date === dateStr);
      let newHistory;
      
      if (existingIndex >= 0) {
        newHistory = [...history];
        newHistory[existingIndex] = { date: dateStr, totalValue: newTotal };
      } else {
        newHistory = [...history, { date: dateStr, totalValue: newTotal }];
      }
      
      if (newHistory.length > 30) newHistory.shift();

      return {
        ...prev,
        history: newHistory
      };
    });
  };

  const handleClearHistory = () => {
    setState((prev) => ({ ...prev, history: [] }));
  };

  // Chart data
  const pieData = [
    { name: "场内纳指 (On-Ex)", value: state.onExchange.currentValue },
    { name: "场外纳指 (Off-Ex)", value: state.offExchange.currentValue },
  ];
  const COLORS = ["#C4F222", "#9D84FF"];

  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] text-[var(--color-text-primary)] p-4 md:p-8 flex transition-colors duration-300">
      <div className="w-full flex flex-col md:flex-row gap-6">
        
        {/* Left Sidebar (Desktop) */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden md:flex flex-col w-64 shrink-0 gap-8"
        >
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
              <Activity className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">NASDAQ</h1>
              <p className="text-xs text-[var(--color-text-secondary)] font-medium">Portfolio Tracker</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2 flex-1">
            <button
              onClick={() => setActiveTab("Overview")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer w-full text-left ${
                activeTab === "Overview"
                  ? "bg-[var(--color-brand)] text-black font-semibold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-color)]"
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("Trends")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer w-full text-left ${
                activeTab === "Trends"
                  ? "bg-[var(--color-brand)] text-black font-semibold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-color)]"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Trends
            </button>
          </nav>

          <div className="mt-auto px-4">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="flex items-center gap-3 py-3 w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-6 w-full">
          {/* Header Mobile */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                <Activity className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">NASDAQ</h1>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Portfolio Tracker</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 shrink-0 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-color)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {/* Main Content Areas */}
          {activeTab === "Overview" && (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="总资产 (Total Asset)"
              value={totalCurrentValue}
              delta={totalPL}
              deltaPercent={totalPLPercent}
            />
            <StatCard
              title="总本金 (Total Principal)"
              value={totalPrincipal}
            />
            <StatCard
              title="总盈亏 (Total P/L)"
              value={totalPL}
              delta={totalPL}
              deltaPercent={totalPLPercent}
            />
            <Card className="flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between">
                <h3 className="text-[var(--color-text-secondary)] font-medium text-sm">目标完成度</h3>
                <div className="w-8 h-8 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-[var(--color-brand)]" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight text-[var(--color-brand)]">
                  {formatPercent(targetProgress)}
                </div>
                <div className="w-full h-2 bg-[var(--color-border-color)] rounded-full mt-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(targetProgress * 100, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-[var(--color-brand)] rounded-full"
                  />
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-2">
                  Target: {formatCurrency(state.targetAmount)}
                </div>
              </div>
            </Card>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: On and Off Exchange Inputs */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* On-Exchange */}
              <Card className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 bg-[var(--color-brand)] rounded-full" />
                  <h2 className="text-xl font-bold tracking-tight">场内纳指 (On-Exchange)</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--color-background)] p-4 rounded-2xl border border-[var(--color-border-color)]">
                    <div className="text-sm text-[var(--color-text-secondary)] mb-1">当前市值 (Current Value)</div>
                    <div className="text-2xl font-semibold">{formatCurrency(state.onExchange.currentValue)}</div>
                    <div className="mt-2 text-sm flex gap-2">
                       盈亏: <span className={onExchangePL >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                         {onExchangePL > 0 ? "+" : ""}{formatCurrency(onExchangePL)} ({formatPercent(onExchangePLPercent)})
                       </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                     <Input
                        label="修改市值 (Update Value)"
                        type="number"
                        prefix="¥"
                        value={state.onExchange.currentValue || ""}
                        onChange={(e) => handleUpdate("onExchange", "currentValue", e.target.value)}
                     />
                     <Input
                        label="修改本金 (Update Principal)"
                        type="number"
                        prefix="¥"
                        value={state.onExchange.principal || ""}
                        onChange={(e) => handleUpdate("onExchange", "principal", e.target.value)}
                     />
                  </div>
                </div>
              </Card>

              {/* Off-Exchange */}
              <Card className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 bg-[var(--color-purple-accent)] rounded-full" />
                  <h2 className="text-xl font-bold tracking-tight">场外纳指 (Off-Exchange)</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--color-background)] p-4 rounded-2xl border border-[var(--color-border-color)]">
                    <div className="text-sm text-[var(--color-text-secondary)] mb-1">当前市值 (Current Value)</div>
                    <div className="text-2xl font-semibold">{formatCurrency(state.offExchange.currentValue)}</div>
                    <div className="mt-2 text-sm flex gap-2">
                       盈亏: <span className={offExchangePL >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                         {offExchangePL > 0 ? "+" : ""}{formatCurrency(offExchangePL)} ({formatPercent(offExchangePLPercent)})
                       </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                     <Input
                        label="修改市值 (Update Value)"
                        type="number"
                        prefix="¥"
                        value={state.offExchange.currentValue || ""}
                        onChange={(e) => handleUpdate("offExchange", "currentValue", e.target.value)}
                     />
                     <Input
                        label="修改本金 (Update Principal)"
                        type="number"
                        prefix="¥"
                        value={state.offExchange.principal || ""}
                        onChange={(e) => handleUpdate("offExchange", "principal", e.target.value)}
                     />
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Col: Charts & Settings */}
            <div className="flex flex-col gap-6">
              <Card className="flex-1 flex flex-col min-h-[300px]">
                <h3 className="text-[var(--color-text-secondary)] font-medium text-sm mb-4">资产分布 (Distribution)</h3>
                
                <div className="flex-1 w-full relative">
                  {(totalCurrentValue > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius="60%"
                          outerRadius="80%"
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-color)', borderRadius: '12px', color: 'var(--color-text-primary)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-tertiary)]">
                      暂无数据 (No Data)
                    </div>
                  )}
                  {/* Center Text */}
                  {(totalCurrentValue > 0) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-[var(--color-text-secondary)] text-xs">Total</div>
                      <div className="text-lg font-bold">{formatCurrency(totalCurrentValue)}</div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="w-3 h-3 rounded-full bg-[var(--color-brand)]" />
                    场内 (On-Ex)
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="w-3 h-3 rounded-full bg-[var(--color-purple-accent)]" />
                    场外 (Off-Ex)
                  </div>
                </div>
              </Card>

              <Card>
                 <h3 className="text-[var(--color-text-secondary)] font-medium text-sm mb-4">目标设定 (Goal Setting)</h3>
                 <Input
                    label="总目标金额 (Target Amount)"
                    type="number"
                    prefix="¥"
                    value={state.targetAmount || ""}
                    onChange={(e) => handleTargetUpdate(e.target.value)}
                 />
              </Card>
            </div>
          </div>
          </>
          )}

          {activeTab === "Trends" && (
            <div className="flex flex-col gap-6 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]">
              <Card className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-8 bg-[var(--color-brand)] rounded-full" />
                    <h2 className="text-xl font-bold tracking-tight">近期趋势 (Recent Trends)</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleClearHistory}
                      className="flex items-center gap-2 px-4 py-2 bg-transparent text-[var(--color-danger)] border border-[var(--color-danger)]/20 rounded-lg font-medium text-sm hover:bg-[var(--color-danger)]/10 transition-colors cursor-pointer"
                    >
                      清空 (Clear)
                    </button>
                    <button 
                      onClick={handleRecordData}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] text-black rounded-lg font-medium text-sm hover:bg-[var(--color-brand-hover)] transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      记录当前资产 (Record Current)
                    </button>
                  </div>
                </div>
                
                <div className="h-[400px] w-full mt-4">
                  {(state.history && state.history.length > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={state.history} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-color)" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="var(--color-text-tertiary)" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          stroke="var(--color-text-tertiary)" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                          dx={-10}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-color)', borderRadius: '12px', color: 'var(--color-text-primary)' }}
                          formatter={(value: number) => formatCurrency(value)}
                          labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="totalValue" 
                          stroke="var(--color-brand)" 
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 6, fill: "var(--color-brand)", stroke: "var(--color-surface)", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--color-text-tertiary)]">
                      暂无趋势数据 (No Trend Data)
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
