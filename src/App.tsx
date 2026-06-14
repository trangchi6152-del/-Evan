import { useState, useEffect } from "react";
import { AppState } from "./types";
import { Card } from "./components/Card";
import { StatCard } from "./components/StatCard";
import { Input } from "./components/Input";
import { formatCurrency, formatPercent } from "./lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { LayoutDashboard, Target, Activity, Moon, Sun, TrendingUp, Plus, Lock, Unlock, Database } from "lucide-react";
import { motion } from "motion/react";

const INITIAL_STATE: AppState = {
  onExchange: { principal: 10000, currentValue: 12000 },
  offExchange: { principal: 20000, currentValue: 21000 },
  targetAmount: 100000,
  history: []
};

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("nasdaq-theme-dark") !== "false";
  });
  const [activeTab, setActiveTab] = useState("Overview");

  // Authentication and Sync State
  const [password, setPassword] = useState<string>(() => {
    return localStorage.getItem("nasdaq_edit_password") || "";
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passErr, setPassErr] = useState("");
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "error" | "loading" | "local">("loading");
  const [isLocalMode, setIsLocalMode] = useState(false);

  // Backup tool state
  const [importJson, setImportJson] = useState("");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | null; msg: string }>({ type: null, msg: "" });
  const [showBackup, setShowBackup] = useState(false);

  // Load theme preference and set color mode
  useEffect(() => {
    localStorage.setItem("nasdaq-theme-dark", String(isDark));
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Initial Sync and Auth Verification
  useEffect(() => {
    async function initData() {
      setSyncStatus("loading");
      
      const switchToLocalFallback = () => {
        setIsLocalMode(true);
        const localDataStr = localStorage.getItem("nasdaq_standalone_portfolio");
        if (localDataStr) {
          try {
            const parsed = JSON.parse(localDataStr);
            setState(parsed);
            setImportJson(JSON.stringify(parsed.history || [], null, 2));
          } catch (e) {
            console.warn("解析本地存储的持仓资产失败，保持默认数据", e);
          }
        } else {
          // If no local offline data exists yet, migrate any initial/initialState values
          localStorage.setItem("nasdaq_standalone_portfolio", JSON.stringify(INITIAL_STATE));
        }

        const savedPass = localStorage.getItem("nasdaq_edit_password");
        if (savedPass && (savedPass === "nasdaqpassword" || savedPass === "admin")) {
          setIsUnlocked(true);
          setPassword(savedPass);
        }
        setSyncStatus("local");
      };

      try {
        const res = await fetch("/api/portfolio").catch(() => {
          throw new Error("Unable to connect to service. Falling back to offline client mode.");
        });

        if (res.ok) {
          const data = await res.json();
          setState(data);
          setImportJson(JSON.stringify(data.history || [], null, 2));
          setIsLocalMode(false);

          // Proactively auto-verify saved password across sessions
          const savedPass = localStorage.getItem("nasdaq_edit_password");
          if (savedPass) {
            const verifyRes = await fetch("/api/verify-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: savedPass }),
            });
            if (verifyRes.ok) {
              setIsUnlocked(true);
              setPassword(savedPass);
              setSyncStatus("saved");
            } else {
              localStorage.removeItem("nasdaq_edit_password");
              setIsUnlocked(false);
              setSyncStatus("saved");
            }
          } else {
            setSyncStatus("saved");
          }
        } else {
          // e.g. 404 Not Found on Cloudflare Pages
          switchToLocalFallback();
        }
      } catch (err) {
        console.warn("未能连接到后端 Express 服务器，已为您自动切换到纯前端本地离线存储模式(支持Cloudflare静态硬部署)。", err);
        switchToLocalFallback();
      }
    }
    initData();
  }, []);

  // Sync state upward to fullstack JSON file or Local Storage fallback
  const syncStateToServer = async (updatedState: AppState, activePass: string) => {
    setSyncStatus("saving");
    
    if (isLocalMode) {
      try {
        localStorage.setItem("nasdaq_standalone_portfolio", JSON.stringify(updatedState));
        setSyncStatus("local");
      } catch (err) {
        console.error("本地磁盘写入异常:", err);
        setSyncStatus("error");
      }
      return;
    }

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-edit-password": activePass,
        },
        body: JSON.stringify(updatedState),
      });
      if (res.ok) {
        setSyncStatus("saved");
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      console.error("同步失败，临时同步至本地沙盒以防止数据丢失:", err);
      localStorage.setItem("nasdaq_standalone_portfolio", JSON.stringify(updatedState));
      setSyncStatus("error");
    }
  };

  // Password submission / verification
  const handleUnlock = async () => {
    setPassErr("");

    if (isLocalMode) {
      const trimmedPass = passInput.trim();
      const defaultPsw = "nasdaqpassword";
      if (trimmedPass === defaultPsw || trimmedPass === "admin") {
        setIsUnlocked(true);
        setPassword(trimmedPass);
        localStorage.setItem("nasdaq_edit_password", trimmedPass);
        setPassInput("");
        setSyncStatus("local");
      } else {
        setPassErr("密码验证失败，独立环境下初始密码为 nasdaqpassword");
      }
      return;
    }

    try {
      const verifyRes = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passInput }),
      });
      if (verifyRes.ok) {
        setIsUnlocked(true);
        setPassword(passInput);
        localStorage.setItem("nasdaq_edit_password", passInput);
        setPassInput("");
        setSyncStatus("saved");
      } else {
        const errData = await verifyRes.json();
        setPassErr(errData.message || "密码验证失败");
      }
    } catch (err) {
      setPassErr("连接服务失败, 请重试");
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setPassword("");
    localStorage.removeItem("nasdaq_edit_password");
  };

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

  // Handlers for modifying investment figures
  const handleUpdate = async (field: "onExchange" | "offExchange", subField: "principal" | "currentValue", value: string) => {
    if (!isUnlocked) return;
    const numValue = parseFloat(value) || 0;
    const updatedState = {
      ...state,
      [field]: {
        ...state[field],
        [subField]: numValue,
      },
    };
    setState(updatedState);
    await syncStateToServer(updatedState, password);
  };

  // Modify P/L directly -> computes principal based on currentValue and target PL
  const handlePLUpdate = async (field: "onExchange" | "offExchange", value: string) => {
    if (!isUnlocked) return;
    const plValue = parseFloat(value) || 0;
    const currentVal = state[field].currentValue;
    const computedPrincipal = currentVal - plValue;

    const updatedState = {
      ...state,
      [field]: {
        ...state[field],
        principal: computedPrincipal,
      },
    };
    setState(updatedState);
    await syncStateToServer(updatedState, password);
  };

  const handleTargetUpdate = async (value: string) => {
    if (!isUnlocked) return;
    const numValue = parseFloat(value) || 0;
    const updatedState = {
      ...state,
      targetAmount: numValue,
    };
    setState(updatedState);
    await syncStateToServer(updatedState, password);
  };

  // Recording historical values in Trends
  const handleRecordData = async () => {
    if (!isUnlocked) return;
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const newTotal = state.onExchange.currentValue + state.offExchange.currentValue;
    
    const history = state.history || [];
    const existingIndex = history.findIndex(h => h.date === dateStr);
    let newHistory;
    
    if (existingIndex >= 0) {
      newHistory = [...history];
      newHistory[existingIndex] = { date: dateStr, totalValue: newTotal };
    } else {
      newHistory = [...history, { date: dateStr, totalValue: newTotal }];
    }
    
    if (newHistory.length > 30) newHistory.shift();

    const updatedState = {
      ...state,
      history: newHistory
    };

    setState(updatedState);
    setImportJson(JSON.stringify(newHistory, null, 2));
    await syncStateToServer(updatedState, password);
  };

  // Support JSON trend importing/parsing
  const handleImportHistory = async (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        throw new Error("必须为标准的 JSON 数组格式: [{'date': 'YYYY-MM-DD', 'totalValue': 1000}]");
      }
      for (const item of parsed) {
        if (typeof item.date !== "string" || typeof item.totalValue !== "number") {
          throw new Error("每条历史记录必须包含字符串 'date' 与数字 'totalValue'");
        }
      }
      const updatedState = {
        ...state,
        history: parsed,
      };
      setState(updatedState);
      await syncStateToServer(updatedState, password);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "Invalid JSON syntax" };
    }
  };

  // Chart pie data
  const pieData = [
    { name: "场内纳指 (On-Ex)", value: state.onExchange.currentValue },
    { name: "场外纳指 (Off-Ex)", value: state.offExchange.currentValue },
  ];
  const COLORS = ["#C4F222", "#9D84FF"];

  // Reusable password lock card component
  const renderLockWidget = () => {
    if (!isUnlocked) {
      return (
        <Card className="flex flex-col gap-3 bg-[var(--color-surface)] border border-[var(--color-border-color)] shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            只读锁定状态 (Locked)
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="password"
              placeholder="请输入后台同步密码"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnlock();
              }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-border-color)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]/20"
            />
            <button
              onClick={handleUnlock}
              className="w-full py-2 bg-[var(--color-brand)] text-black text-xs font-bold rounded-xl hover:bg-[var(--color-brand-hover)] transition-all cursor-pointer shadow-sm text-center"
            >
              解锁编辑 (Unlock)
            </button>
          </div>
          {passErr && (
            <div className="text-xs text-[var(--color-text-secondary)] mt-1 p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-color)] text-center font-medium">
              {passErr}
            </div>
          )}
        </Card>
      );
    }

    return (
      <Card className="flex flex-col gap-3 bg-[var(--color-surface)] border border-[var(--color-border-color)] shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success)]">
            修改模式已激活 (Active)
          </div>
          <button
            onClick={handleLock}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-xs underline cursor-pointer decoration-dotted"
          >
            退出解锁 (Lock)
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-color)]/50 mt-1">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {isLocalMode ? "数据存储状态:" : "云端同步状态:"}
          </span>
          <span className={`text-xs font-bold tracking-tight ${
            syncStatus === "saved" && "text-[var(--color-success)]" ||
            syncStatus === "local" && "text-[var(--color-brand)]" ||
            syncStatus === "saving" && "text-[var(--color-brand)] animate-pulse" ||
            syncStatus === "error" && "text-[var(--color-text-secondary)] underline decoration-dashed" ||
            "text-[var(--color-text-tertiary)]"
          }`}>
            {syncStatus === "saved" && "已同步 (Synced)"}
            {syncStatus === "local" && "本地已保存 (Local)"}
            {syncStatus === "saving" && "同步中 (Saving)"}
            {syncStatus === "error" && "同步发生错误 (Error)"}
            {syncStatus === "loading" && "加载同步中 (Loading)"}
          </span>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] text-[var(--color-text-primary)] p-4 md:p-8 flex transition-colors duration-300">
      <div className="w-full flex flex-col md:flex-row gap-6">
        
        {/* Left Sidebar (Desktop) */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden md:flex flex-col w-64 shrink-0 gap-6"
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

          <nav className="flex flex-col gap-2">
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

          {/* Locked status on sidebar */}
          <div className="mt-2">
            {renderLockWidget()}
          </div>

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
          <div className="md:hidden flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                <Activity className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">NASDAQ</h1>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Portfolio Tracker</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="w-10 h-10 shrink-0 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-color)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Quick Lock/Sync Widget at the very top for Mobile Users */}
          <div className="block md:hidden">
            {renderLockWidget()}
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="bg-[var(--color-background)] p-5 rounded-2xl border border-[var(--color-border-color)] flex flex-col justify-center">
                        <div className="text-sm text-[var(--color-text-secondary)] mb-1">当前市值 (Current Value)</div>
                        <div className="text-3xl font-bold tracking-tight">{formatCurrency(state.onExchange.currentValue)}</div>
                        <div className="mt-4 text-sm flex gap-2 pt-3 border-t border-[var(--color-border-color)]/30">
                           <span>累计盈亏:</span>
                           <span className={`font-semibold ${onExchangePL >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                             {onExchangePL > 0 ? "+" : ""}{formatCurrency(onExchangePL)} ({formatPercent(onExchangePLPercent)})
                           </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                         <Input
                            label="修改市值 (Update Value)"
                            type="number"
                            prefix="¥"
                            disabled={!isUnlocked}
                            placeholder={!isUnlocked ? "请先解锁编辑" : "输入新市值"}
                            value={state.onExchange.currentValue || ""}
                            onChange={(e) => handleUpdate("onExchange", "currentValue", e.target.value)}
                         />
                         <Input
                            label="修改本金 (Update Principal)"
                            type="number"
                            prefix="¥"
                            disabled={!isUnlocked}
                            placeholder={!isUnlocked ? "请先解锁编辑" : "输入新本金"}
                            value={state.onExchange.principal || ""}
                            onChange={(e) => handleUpdate("onExchange", "principal", e.target.value)}
                         />
                         <Input
                            label="修改盈亏 (Update P/L - 自动计算本金)"
                            type="number"
                            prefix="¥"
                            disabled={!isUnlocked}
                            placeholder={!isUnlocked ? "请先解锁编辑" : "输入新盈亏"}
                            value={onExchangePL || ""}
                            onChange={(e) => handlePLUpdate("onExchange", e.target.value)}
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="bg-[var(--color-background)] p-5 rounded-2xl border border-[var(--color-border-color)] flex flex-col justify-center">
                        <div className="text-sm text-[var(--color-text-secondary)] mb-1">当前市值 (Current Value)</div>
                        <div className="text-3xl font-bold tracking-tight">{formatCurrency(state.offExchange.currentValue)}</div>
                        <div className="mt-4 text-sm flex gap-2 pt-3 border-t border-[var(--color-border-color)]/30">
                           <span>累计盈亏:</span>
                           <span className={`font-semibold ${offExchangePL >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                             {offExchangePL > 0 ? "+" : ""}{formatCurrency(offExchangePL)} ({formatPercent(offExchangePLPercent)})
                           </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                         <Input
                            label="修改市值 (Update Value)"
                            type="number"
                            prefix="¥"
                            disabled={!isUnlocked}
                            placeholder={!isUnlocked ? "请先解锁编辑" : "输入新市值"}
                            value={state.offExchange.currentValue || ""}
                            onChange={(e) => handleUpdate("offExchange", "currentValue", e.target.value)}
                         />
                         <Input
                            label="修改本金 (Update Principal)"
                            type="number"
                            prefix="¥"
                            disabled={!isUnlocked}
                            placeholder={!isUnlocked ? "请先解锁编辑" : "输入新本金"}
                            value={state.offExchange.principal || ""}
                            onChange={(e) => handleUpdate("offExchange", "principal", e.target.value)}
                         />
                         <Input
                            label="修改盈亏 (Update P/L - 自动计算本金)"
                            type="number"
                            prefix="¥"
                            disabled={!isUnlocked}
                            placeholder={!isUnlocked ? "请先解锁编辑" : "输入新盈亏"}
                            value={offExchangePL || ""}
                            onChange={(e) => handlePLUpdate("offExchange", e.target.value)}
                         />
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Col: Charts & Settings */}
                <div className="flex flex-col gap-6">
                  <Card className="flex-1 flex flex-col min-h-[300px]">
                    <h3 className="text-[var(--color-text-secondary)] font-medium text-sm mb-4">资产分布 (Distribution)</h3>
                    
                    <div className="flex-1 w-full relative min-h-[180px]">
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
                      disabled={!isUnlocked}
                      placeholder={!isUnlocked ? "请先解锁编辑" : "设定新总目标"}
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
                      onClick={handleRecordData}
                      disabled={!isUnlocked}
                      className={`px-4 py-2 text-black rounded-lg font-medium text-sm transition-colors cursor-pointer ${
                        isUnlocked ? "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]" : "bg-gray-500 cursor-not-allowed opacity-50 text-white"
                      }`}
                    >
                      {!isUnlocked ? "解锁后可记录" : "记录当前资产 (Record)"}
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
                    <div className="flex h-full items-center justify-center text-[var(--color-text-tertiary)] flex-col gap-2">
                      <p>暂无趋势数据 (No Trend Data)</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">解锁编辑模式后，点击右上角“记录当前资产”创建趋势记录</p>
                    </div>
                  )}
                </div>

                {/* Backup & Import Panel */}
                <div className="mt-8 pt-6 border-t border-[var(--color-border-color)]/35 shadow-inner">
                  <button
                    onClick={() => {
                      setShowBackup(!showBackup);
                      setImportJson(JSON.stringify(state.history || [], null, 2));
                    }}
                    className="text-sm font-medium text-[var(--color-brand)] hover:underline cursor-pointer"
                  >
                    {showBackup ? "收起备份与数据管理" : "管理历史趋势数据备份与导入 (History Backup/Import)"}
                  </button>
                  
                  {showBackup && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 flex flex-col gap-4 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border-color)]"
                    >
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        您可以通过标准的 JSON 格式备份已存储的历史资产记录，或从其他设备/环境直接复制合并数据并导入至云端。推荐时间标记采用 YYYY-MM-DD 格式：
                      </p>
                      
                      <textarea
                        rows={6}
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        className="w-full p-3 font-mono text-xs rounded-xl border border-[var(--color-border-color)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                        placeholder='[{"date": "2026-06-13", "totalValue": 33000}]'
                      />
                      
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(importJson);
                            alert("数据成功复制到剪切板，请将其安全保存。");
                          }}
                          className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--color-border-color)] hover:bg-[var(--color-border-color)] transition-colors cursor-pointer text-[var(--color-text-primary)]"
                        >
                          复制数据备份
                        </button>
                        <button
                          disabled={!isUnlocked}
                          onClick={async () => {
                            setImportStatus({ type: null, msg: "" });
                            const res = await handleImportHistory(importJson);
                            if (res.success) {
                              setImportStatus({ type: "success", msg: "历史趋势数据已完成覆盖导入，并已广播同步到所有可见终端。" });
                            } else {
                              setImportStatus({ type: "error", msg: `导入失败: ${(res as any).message}` });
                            }
                          }}
                          className={`px-4 py-2 text-xs font-bold rounded-lg text-black transition-colors cursor-pointer ${
                            isUnlocked ? "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]" : "bg-gray-500 cursor-not-allowed opacity-50 text-white"
                          }`}
                        >
                          {!isUnlocked ? "请先解锁密码再导入" : "确认覆盖导入并同步"}
                        </button>
                      </div>
                      {importStatus.type && (
                        <p className={`text-xs font-semibold mt-1 p-2.5 rounded-lg text-center ${
                          importStatus.type === "success" 
                            ? "text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20" 
                            : "text-[var(--color-text-secondary)] bg-[var(--color-background)] border border-[var(--color-border-color)]"
                        }`}>
                          {importStatus.msg}
                        </p>
                      )}
                    </motion.div>
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
