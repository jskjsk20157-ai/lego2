/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Search, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Info, 
  ShoppingBag,
  ArrowRight,
  Loader2,
  History,
  ExternalLink,
  ShieldAlert,
  TrendingUp,
  Globe,
  Heart,
  Bell,
  Trash2,
  LogIn,
  LogOut,
  User as UserIcon,
  Layers,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  LineChart, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Label
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { POPULAR_LEGO_SETS, type LegoSet } from './constants';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  type User 
} from './firebase';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface HistoricalPoint {
  date: string;
  price: number;
  mall?: string;
  mallUrl?: string;
  discountRate?: number;
}

interface AnalysisResult {
  title: string;
  imageUrl: string;
  status: 'buy' | 'wait' | 'expensive';
  statusText: string;
  summary: string;
  evidence: string;
  tip: string;
  originalPrice: number;
  averagePrice: number;
  lowestPrice: number;
  lowestPriceDate: string;
  lowestPriceMall: string;
  pieceCount: number;
  ppp: number; // Price per Piece
  usedPrices: {
    misb: number;
    mib: number;
    used: number;
  };
  malls: {
    name: string;
    price: number;
    discountRate: number;
    url: string;
    isLowest?: boolean;
  }[];
  retirementRisk: 'low' | 'medium' | 'high';
  retirementReason: string;
  investmentScore: number; // 0-100
  investmentReason: string;
  globalPrices: {
    amazon?: number;
    bricklink?: number;
    currency: string;
  };
  historicalData: HistoricalPoint[];
  historicalDataUsed: HistoricalPoint[];
}

interface WishlistItem {
  id?: string;
  number: string;
  name: string;
  image: string;
  addedAt: string;
  uid: string;
}

type Period = 'all' | '1y' | '6m';
type ChartInterval = 'weekly' | 'monthly';
type AnalysisTab = 'new' | 'used';
type UsedCategory = 'misb' | 'mib' | 'used';

export default function App() {
  const [setNumber, setSetNumber] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [chartInterval, setChartInterval] = useState<ChartInterval>('monthly');
  const [suggestions, setSuggestions] = useState<LegoSet[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [isAlertSet, setIsAlertSet] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('new');
  const [usedCategory, setUsedCategory] = useState<UsedCategory>('misb');

  const [showLowestTooltip, setShowLowestTooltip] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Sync Wishlist with Firestore
  useEffect(() => {
    if (!user) {
      setWishlist([]);
      return;
    }

    const q = query(collection(db, 'wishlists'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem));
      setWishlist(items);
    });

    return () => unsubscribe();
  }, [user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError('로그인 중 오류가 발생했습니다.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleWishlist = async (set: { number: string, name: string, image: string }) => {
    if (!user) {
      setError('위시리스트를 사용하려면 로그인이 필요합니다.');
      return;
    }

    const exists = wishlist.find(item => item.number === set.number);
    if (exists) {
      if (exists.id) {
        await deleteDoc(doc(db, 'wishlists', exists.id));
      }
    } else {
      await addDoc(collection(db, 'wishlists'), {
        ...set,
        addedAt: new Date().toISOString(),
        uid: user.uid
      });
    }
  };

  // Debounced suggestion search
  useEffect(() => {
    if (setNumber.length >= 2) {
      const localMatches = POPULAR_LEGO_SETS.filter(s => 
        s.number.includes(setNumber) || s.name.toLowerCase().includes(setNumber.toLowerCase())
      );
      setSuggestions(localMatches.slice(0, 8));
      setShowSuggestions(localMatches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [setNumber]);

  const selectSuggestion = (s: LegoSet) => {
    setSetNumber(s.number);
    setShowSuggestions(false);
  };

  const analyzeLego = async (overrideInterval?: ChartInterval) => {
    if (!setNumber || !currentPrice) {
      setError('제품 번호와 현재 가격을 모두 입력해주세요.');
      return;
    }

    const targetInterval = overrideInterval || chartInterval;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const model = "gemini-3-flash-preview";
      const prompt = `
        당신은 레고 시장 분석 전문가입니다. 다음 레고 제품에 대한 심층적인 역사적 가격 및 중고 시장 분석을 수행해주세요.
        
        제품 번호: ${setNumber}
        사용자가 입력한 현재 가격: ${currentPrice}원
        데이터 간격 요구사항: ${targetInterval === 'weekly' ? '최근 6개월간 매주(Weekly) 단위의 정밀한 가격 데이터' : '출시 이후 매월(Monthly) 단위의 가격 데이터'}
        
        [분석 및 출력 요구사항]
        1. 제품명(title), 정가(MSRP), 부품 수(Piece Count), 이미지 URL(imageUrl - 공식 또는 고화질 예상 URL)을 확인하세요.
        2. 역대 최저가(All-time Low)와 그 날짜, 쇼핑몰 이름, 그리고 해당 쇼핑몰의 당시 상품 URL(예상)을 포함하세요.
        3. ${targetInterval === 'weekly' ? '최근 6개월간 주차별' : '출시 이후 월별'} 가격 변동 트렌드를 조사하세요. (새상품 기준, historicalData 필드)
           - 데이터 포인트는 반드시 ${targetInterval === 'weekly' ? '20개 이상' : '12개 이상'} 포함되어야 합니다.
           - 날짜 형식은 YYYY-MM-DD로 통일하세요.
        4. 중고 시장(MISB 기준)의 동일 기간 가격 변동 트렌드도 함께 조사하세요. (historicalDataUsed 필드)
        5. 현재 유통 중인 주요 쇼핑몰의 실시간 가격과 정확한 URL을 조사하세요.
        6. 중고 시장 시세를 분석하세요 (MISB, MIB, Used).
        7. 이 제품의 단종 예상 시기와 단종 위험도를 분석하세요.
        8. 재테크 지수(0-100)와 해외 가격(Amazon, BrickLink)을 조사하세요.
        
        [출력 형식 - JSON]
        {
          "title": "제품명",
          "imageUrl": "이미지 URL",
          "status": "buy" | "wait" | "expensive",
          "statusText": "...",
          "summary": "...",
          "evidence": "...",
          "tip": "...",
          "originalPrice": 123000,
          "averagePrice": 110000,
          "lowestPrice": 95000,
          "lowestPriceDate": "2023-11-24",
          "lowestPriceMall": "...",
          "pieceCount": 1500,
          "ppp": 82,
          "usedPrices": {
            "misb": 130000,
            "mib": 110000,
            "used": 85000
          },
          "retirementRisk": "low" | "medium" | "high",
          "retirementReason": "...",
          "investmentScore": 85,
          "investmentReason": "...",
          "globalPrices": {
            "amazon": 99.99,
            "bricklink": 110.00,
            "currency": "USD"
          },
          "malls": [
            { "name": "...", "price": 105000, "discountRate": 15, "url": "...", "isLowest": true }
          ],
          "historicalData": [
            { "date": "2023-01-01", "price": 123000, "mall": "...", "mallUrl": "...", "discountRate": 0 }
          ],
          "historicalDataUsed": [
            { "date": "2023-01-01", "price": 115000, "mall": "중고장터", "mallUrl": "...", "discountRate": 0 }
          ]
        }
        
        반드시 한국어로 답변하고, Google Search를 활용하여 실제 데이터를 최대한 반영하세요.
      `;

      const response = await genAI.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const data = JSON.parse(response.text || "{}");
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredData = result ? (() => {
    const rawData = activeTab === 'new' ? result.historicalData : (result.historicalDataUsed || []);
    if (!Array.isArray(rawData)) return [];
    let data = [...rawData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (period === 'all') return data;
    
    const cutoff = new Date();
    const months = period === '1y' ? 12 : 6;
    cutoff.setMonth(cutoff.getMonth() - months);
    
    return data.filter(p => new Date(p.date) >= cutoff);
  })() : [];

  return (
    <div className="min-h-screen bg-[#FFF9E5] text-[#202124] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-[#e53935]/90 backdrop-blur-md border-b-4 border-black/5 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/80 rounded-xl flex items-center justify-center shadow-sm border border-black/5">
              <ShoppingBag className="text-[#e53935] w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">현명하게 레고하기</h1>
              <div className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em]">SMART BRICK ADVISOR</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-white/10 p-1.5 pr-4 rounded-full border border-white/10">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-full h-full object-cover" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-[10px] font-black text-white/60 uppercase leading-none mb-1">WELCOME</div>
                  <div className="text-xs font-black text-white leading-none">{user.displayName}</div>
                </div>
                <button 
                  onClick={logout}
                  className="ml-2 p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={login}
                className="flex items-center gap-2 bg-white text-[#e53935] px-4 py-2 rounded-full font-black text-sm hover:bg-[#fff176] transition-all shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Search Section */}
        <section className="bg-white/80 backdrop-blur-sm rounded-[2rem] border-2 border-[#dadce0] p-8 mb-8 shadow-sm relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="relative">
              <label className="block text-xs font-black text-[#70757a] uppercase mb-2 ml-4">제품 번호</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-[#e53935]" />
                </div>
                <input 
                  type="text" 
                  placeholder="예: 10316"
                  value={setNumber}
                  onChange={(e) => setSetNumber(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full pl-14 pr-6 py-4 bg-[#f8f9fa] border-2 border-[#dadce0] rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#fff176]/50 focus:border-[#e53935] transition-all text-lg font-bold"
                />
                
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-[#dadce0] rounded-2xl shadow-xl z-[60] overflow-hidden"
                    >
                      <div className="divide-y divide-[#f1f3f4]">
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectSuggestion(s)}
                            className="w-full p-4 flex items-center gap-4 hover:bg-[#FFF9E5] transition-colors text-left group"
                          >
                            <div className="w-16 h-16 bg-[#f1f3f4] rounded-lg overflow-hidden flex-shrink-0 border-2 border-transparent group-hover:border-[#e53935]">
                              <img 
                                src={s.image} 
                                alt={s.name} 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${s.number}/100/100`;
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-black text-[#e53935]">{s.number}</div>
                              <div className="text-sm font-bold text-[#3c4043] truncate">{s.name}</div>
                              {s.year && <div className="text-[10px] font-bold text-[#70757a]">{s.year} 출시</div>}
                            </div>
                            <ArrowRight className="w-4 h-4 text-[#dadce0] group-hover:text-[#e53935] transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="relative">
              <label className="block text-xs font-black text-[#70757a] uppercase mb-2 ml-4">현재 판매가</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <TrendingDown className="w-5 h-5 text-[#42a5f5]" />
                </div>
                <input 
                  type="number" 
                  placeholder="원 단위 입력"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-[#f8f9fa] border-2 border-[#dadce0] rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#fff176]/50 focus:border-[#42a5f5] transition-all text-lg font-bold"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={() => analyzeLego()}
            disabled={isAnalyzing}
            className="w-full bg-[#e53935] hover:bg-[#d32f2f] disabled:bg-[#e53935]/50 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 text-xl shadow-md active:shadow-none active:translate-y-[2px]"
          >
            {isAnalyzing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Search className="w-6 h-6" />
                분석 시작하기
              </>
            )}
          </button>
        </section>

        {/* Wishlist Section */}
        {wishlist.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6 px-4">
              <h3 className="text-xl font-black text-[#3c4043] flex items-center gap-3">
                <Heart className="w-6 h-6 text-[#e53935] fill-[#e53935]" />
                나의 위시리스트
              </h3>
              <span className="text-xs font-bold text-[#70757a]">{wishlist.length}개의 제품</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {wishlist.map((item) => (
                <motion.div 
                  layout
                  key={item.number}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-[#dadce0] p-4 relative group hover:border-[#e53935] transition-all"
                >
                  <button 
                    onClick={() => toggleWishlist(item)}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-[#70757a] hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="aspect-square bg-[#f8f9fa] rounded-xl mb-3 overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-contain p-2"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-[10px] font-black text-[#e53935] mb-1">{item.number}</div>
                  <div className="text-xs font-bold text-[#3c4043] truncate mb-3">{item.name}</div>
                  <button 
                    onClick={() => {
                      setSetNumber(item.number);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full py-2 bg-[#f1f3f4] hover:bg-[#e53935] hover:text-white rounded-lg text-[10px] font-black transition-all"
                  >
                    지금 분석하기
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Product Header Card */}
              <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border-2 border-[#e53935] shadow-lg flex flex-col md:flex-row items-center gap-8">
                <div className="w-48 h-48 bg-[#f8f9fa] rounded-3xl overflow-hidden flex-shrink-0 border-2 border-[#dadce0] p-4">
                  <img 
                    src={result.imageUrl || `https://picsum.photos/seed/${setNumber}/400/400`} 
                    alt={result.title} 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${setNumber}/400/400`;
                    }}
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-block px-4 py-1.5 bg-[#e53935] text-white rounded-full text-xs font-black mb-3 tracking-widest">
                    ANALYSIS RESULT
                  </div>
                  <h2 className="text-3xl font-black text-[#3c4043] mb-2 leading-tight">
                    {result.title}
                  </h2>
                  <div className="text-xl font-black text-[#e53935] flex items-center justify-center md:justify-start gap-2">
                    <Tag className="w-5 h-5" />
                    SET #{setNumber}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                    <div className="px-3 py-1 bg-[#f1f3f4] rounded-lg text-xs font-bold text-[#70757a]">
                      {result.pieceCount.toLocaleString()} Pieces
                    </div>
                    <div className="px-3 py-1 bg-[#f1f3f4] rounded-lg text-xs font-bold text-[#70757a]">
                      MSRP ₩{result.originalPrice.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button 
                  onClick={() => toggleWishlist({ 
                    number: setNumber, 
                    name: suggestions.find(s => s.number === setNumber)?.name || `LEGO ${setNumber}`,
                    image: suggestions.find(s => s.number === setNumber)?.image || `https://picsum.photos/seed/${setNumber}/200/200`
                  })}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all border-2",
                    wishlist.find(i => i.number === setNumber) 
                      ? "bg-[#e53935] text-white border-[#e53935]" 
                      : "bg-white text-[#e53935] border-[#e53935] hover:bg-red-50"
                  )}
                >
                  <Heart className={cn("w-5 h-5", wishlist.find(i => i.number === setNumber) && "fill-white")} />
                  {wishlist.find(i => i.number === setNumber) ? '위시리스트에서 제거' : '위시리스트에 담기'}
                </button>
                
                <button 
                  onClick={() => setIsAlertSet(!isAlertSet)}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all border-2",
                    isAlertSet 
                      ? "bg-[#42a5f5] text-white border-[#42a5f5]" 
                      : "bg-white text-[#42a5f5] border-[#42a5f5] hover:bg-blue-50"
                  )}
                >
                  <Bell className={cn("w-5 h-5", isAlertSet && "fill-white")} />
                  {isAlertSet ? '가격 알림 해제' : '최저가 알림 받기'}
                </button>
              </div>
              {/* Tabs for New vs Used */}
              <div className="flex gap-2 mb-8 bg-[#f1f3f4]/50 p-1.5 rounded-2xl border-2 border-[#dadce0]">
                <button 
                  onClick={() => setActiveTab('new')}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all",
                    activeTab === 'new' ? "bg-white text-[#e53935] shadow-md" : "text-[#70757a] hover:bg-white/50"
                  )}
                >
                  <ShoppingBag className="w-4 h-4" />
                  새상품 분석
                </button>
                <button 
                  onClick={() => setActiveTab('used')}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all",
                    activeTab === 'used' ? "bg-white text-[#42a5f5] shadow-md" : "text-[#70757a] hover:bg-white/50"
                  )}
                >
                  <History className="w-4 h-4" />
                  중고 시세 분석
                </button>
              </div>

              {/* Investment & Stats Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border-2 border-[#dadce0] shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-[#3c4043]">재테크 지수</h4>
                      <div className="text-xs font-bold text-[#70757a]">Investment Score</div>
                    </div>
                  </div>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-5xl font-black text-emerald-600">{result.investmentScore}</span>
                    <span className="text-xl font-black text-[#70757a] mb-1">/ 100</span>
                  </div>
                  <p className="text-sm font-bold text-[#70757a] leading-relaxed">{result.investmentReason}</p>
                </div>

                <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border-2 border-[#dadce0] shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Tag className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-[#3c4043]">브릭당 가격 (PPP)</h4>
                      <div className="text-xs font-bold text-[#70757a]">Price Per Piece</div>
                    </div>
                  </div>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-5xl font-black text-amber-600">₩{result.ppp}</span>
                    <span className="text-sm font-black text-[#70757a] mb-1">/ 브릭</span>
                  </div>
                  <div className="text-xs font-bold text-[#70757a]">총 부품 수: {result.pieceCount.toLocaleString()} pcs</div>
                </div>
              </div>

              {/* Used Analysis (Only in Used Tab) */}
              {activeTab === 'used' && (
                <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border-2 border-[#dadce0] shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Layers className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-[#3c4043]">중고 시세 상세</h4>
                      <div className="text-xs font-bold text-[#70757a]">Used Categories</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['misb', 'mib', 'used'] as UsedCategory[]).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setUsedCategory(cat)}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-all text-center",
                          usedCategory === cat ? "bg-blue-50 border-blue-400" : "bg-white border-[#dadce0]"
                        )}
                      >
                        <div className="text-[8px] font-black uppercase mb-1">{cat}</div>
                        <div className="text-xs font-black">₩{(result.usedPrices[cat] / 1000).toFixed(0)}k</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-xl font-black text-blue-700">
                      ₩{result.usedPrices[usedCategory].toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Retirement Risk Card */}
              <div className={cn(
                "rounded-[2rem] p-8 border-2 border-[#dadce0] shadow-sm flex items-center gap-6",
                result.retirementRisk === 'high' ? "bg-orange-50/80" : "bg-white/80"
              )}>
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-black/5",
                  result.retirementRisk === 'high' ? "bg-orange-500 text-white" :
                  result.retirementRisk === 'medium' ? "bg-amber-500 text-white" :
                  "bg-emerald-500 text-white"
                )}>
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-lg font-black text-[#3c4043]">단종 위험도:</h4>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider",
                      result.retirementRisk === 'high' ? "bg-orange-100 text-orange-700" :
                      result.retirementRisk === 'medium' ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {result.retirementRisk === 'high' ? '위험 (곧 단종)' : 
                       result.retirementRisk === 'medium' ? '보통 (내년 예상)' : '안전 (판매 중)'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#70757a]">{result.retirementReason}</p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] border-2 border-[#dadce0] overflow-hidden shadow-sm">
                <div className={cn(
                  "px-8 py-6 flex items-center justify-between border-b-2 border-[#dadce0]",
                  result.status === 'buy' ? "bg-emerald-50/50" :
                  result.status === 'wait' ? "bg-amber-50/50" :
                  "bg-red-50/50"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-black/5",
                      result.status === 'buy' ? "bg-emerald-400 text-white" :
                      result.status === 'wait' ? "bg-amber-400 text-white" :
                      "bg-red-400 text-white"
                    )}>
                      {result.statusText.split(' ')[0]}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-[#3c4043] leading-tight">{result.statusText.split(' ').slice(1).join(' ')}</h2>
                      <div className="text-sm font-bold text-[#70757a] mt-1">{result.summary}</div>
                    </div>
                  </div>
                </div>

                {/* Price Stats Grid */}
                <div className="grid grid-cols-3 divide-x-2 divide-[#dadce0] border-b-2 border-[#dadce0] bg-[#f8f9fa]/50">
                  <div className="p-6 text-center">
                    <div className="text-[10px] font-black text-[#70757a] uppercase mb-2 tracking-wider">정가 (MSRP)</div>
                    <div className="text-xl font-black">₩{result.originalPrice.toLocaleString()}</div>
                  </div>
                  <div className="p-6 text-center">
                    <div className="text-[10px] font-black text-[#70757a] uppercase mb-2 tracking-wider">평균가</div>
                    <div className="text-xl font-black">₩{result.averagePrice.toLocaleString()}</div>
                  </div>
                  <div 
                    className="p-6 text-center group relative cursor-help bg-white/50"
                    onClick={() => setShowLowestTooltip(!showLowestTooltip)}
                  >
                    <div className="text-[10px] font-black text-[#70757a] uppercase mb-2 tracking-wider">역대 최저가</div>
                    <div className="text-xl font-black text-[#e53935]">₩{result.lowestPrice.toLocaleString()}</div>
                    
                    {/* Tooltip for Lowest Price Details */}
                    <div className={cn(
                      "absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 p-4 bg-[#202124]/90 backdrop-blur-md text-white text-xs rounded-2xl transition-opacity pointer-events-none z-10 shadow-xl border border-white/10",
                      showLowestTooltip ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <div className="font-black mb-2 text-[#fff176] text-sm border-b border-white/10 pb-2">역대 최저가 기록</div>
                      <div className="space-y-1 font-bold">
                        <div className="flex justify-between"><span className="text-white/60">날짜</span> <span>{result.lowestPriceDate}</span></div>
                        <div className="flex justify-between"><span className="text-white/60">판매처</span> <span className="text-blue-300">{result.lowestPriceMall}</span></div>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#202124]/90"></div>
                    </div>
                  </div>
                </div>

                {/* Price Trend Chart */}
                <div className="p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <h3 className="text-lg font-black text-[#3c4043] flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#42a5f5] rounded-lg flex items-center justify-center shadow-sm">
                        <History className="w-5 h-5 text-white" />
                      </div>
                      {activeTab === 'new' ? '새상품' : '중고(MISB)'} 가격 변동 히스토리
                    </h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {/* Interval Selector */}
                      <div className="flex bg-[#f1f3f4]/50 p-1.5 rounded-xl border border-[#dadce0]">
                        {(['monthly', 'weekly'] as ChartInterval[]).map((i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setChartInterval(i);
                              analyzeLego(i);
                            }}
                            className={cn(
                              "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all",
                              chartInterval === i ? "bg-white text-[#42a5f5] shadow-sm border border-[#dadce0]" : "text-[#70757a] hover:text-[#3c4043]"
                            )}
                          >
                            {i === 'monthly' ? '월별' : '주별'}
                          </button>
                        ))}
                      </div>

                      {/* Period Selector */}
                      <div className="flex bg-[#f1f3f4]/50 p-1.5 rounded-xl border border-[#dadce0]">
                        {(['all', '1y', '6m'] as Period[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                              "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all",
                              period === p ? "bg-white text-[#e53935] shadow-sm border border-[#dadce0]" : "text-[#70757a] hover:text-[#3c4043]"
                            )}
                          >
                            {p === 'all' ? '전체' : p === '1y' ? '1년' : '6개월'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full overflow-x-auto pb-4 cursor-grab active:cursor-grabbing scrollbar-hide">
                    <div style={{ minWidth: filteredData.length > 12 ? `${filteredData.length * 40}px` : '100%' }}>
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={filteredData} 
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload.length) {
                                const point = data.activePayload[0].payload as HistoricalPoint;
                                if (point.mallUrl) {
                                  window.open(point.mallUrl, '_blank');
                                }
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#70757a', fontWeight: 700 }}
                              interval={0}
                            />
                            <YAxis 
                              hide 
                              domain={['auto', 'auto']} 
                              padding={{ top: 30, bottom: 30 }}
                            />
                            <Tooltip 
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload as HistoricalPoint;
                                  return (
                                    <div className="bg-[#202124]/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl border border-white/10 text-xs min-w-[160px]">
                                      <div className="font-black mb-2 border-b border-white/10 pb-2 text-[#fff176]">{label}</div>
                                      <div className="space-y-2 font-bold">
                                        <div className="flex justify-between gap-4">
                                          <span className="text-white/60">가격</span>
                                          <span className="text-lg">₩{data.price.toLocaleString()}</span>
                                        </div>
                                        {data.mall && (
                                          <div className="flex justify-between gap-4">
                                            <span className="text-white/60">판매처</span>
                                            <span className="text-blue-300">{data.mall}</span>
                                          </div>
                                        )}
                                        {data.mallUrl && (
                                          <div className="text-[9px] text-[#fff176] mt-1 italic">클릭 시 판매처로 이동</div>
                                        )}
                                        {data.discountRate !== undefined && (
                                          <div className="flex justify-between gap-4">
                                            <span className="text-white/60">할인율</span>
                                            <span className="text-red-300">{data.discountRate}%</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            {/* Current Price Reference Line */}
                            {activeTab === 'new' && (
                              <ReferenceLine 
                                y={Number(currentPrice)} 
                                stroke="#42a5f5" 
                                strokeDasharray="5 5" 
                                strokeWidth={2}
                              >
                                <Label 
                                  value="현재가" 
                                  position="right" 
                                  fill="#42a5f5" 
                                  fontSize={10} 
                                  fontWeight={900} 
                                />
                              </ReferenceLine>
                            )}
                            <Line 
                              type="monotone" 
                              dataKey="price" 
                              stroke={activeTab === 'new' ? "#e53935" : "#42a5f5"} 
                              strokeWidth={4} 
                              dot={{ r: 4, fill: activeTab === 'new' ? '#e53935' : '#42a5f5', stroke: '#fff', strokeWidth: 2 }}
                              activeDot={{ r: 8, fill: activeTab === 'new' ? '#e53935' : '#42a5f5', stroke: '#fff', strokeWidth: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mall List (Current Status) */}
              <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] border-2 border-[#dadce0] overflow-hidden shadow-sm">
                <div className="px-8 py-5 border-b-2 border-[#dadce0] bg-[#f8f9fa]/50 flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#3c4043]">현재 판매처별 실시간 가격</h3>
                  <span className="text-[11px] font-black text-[#70757a] bg-white px-3 py-1 rounded-full border border-[#dadce0]">정가 ₩{result.originalPrice.toLocaleString()} 대비</span>
                </div>
                <div className="divide-y divide-[#f1f3f4]">
                  {Array.isArray(result.malls) && result.malls.map((mall, idx) => (
                    <a 
                      key={idx} 
                      href={mall.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-8 py-6 flex items-center justify-between hover:bg-[#FFF9E5]/50 transition-all group"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white border border-[#dadce0] rounded-2xl flex items-center justify-center group-hover:border-[#e53935]/30 transition-colors shadow-sm">
                          <ShoppingBag className="w-7 h-7 text-[#5f6368] group-hover:text-[#e53935] transition-colors" />
                        </div>
                        <div>
                          <div className="text-base font-black text-[#3c4043] mb-1 flex items-center gap-2">
                            {mall.name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-[#d93025]">{mall.discountRate}% 할인</span>
                            <span className="text-[11px] font-bold text-[#70757a] line-through">₩{result.originalPrice.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-xl font-black",
                          mall.isLowest ? "text-[#e53935]" : "text-[#3c4043]"
                        )}>
                          ₩{mall.price.toLocaleString()}
                        </div>
                        {mall.isLowest ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 rounded-lg text-[11px] font-black text-[#e53935] mt-2 border border-red-100">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 최저가
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-[#70757a] mt-2">
                            평균 대비 {mall.price < result.averagePrice ? '저렴' : '높음'}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Expert Advice */}
              <div className="bg-[#E3F2FD]/50 backdrop-blur-sm rounded-[2rem] p-8 border-2 border-[#dadce0] shadow-sm">
                <div className="flex gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-black/5">
                    <Info className="w-8 h-8 text-[#42a5f5]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-[#42a5f5] mb-3">전문가 분석 리포트</h4>
                    <div className="text-base text-[#3c4043] leading-relaxed mb-6 font-bold">
                      <Markdown>{result.evidence}</Markdown>
                    </div>
                    <div className="bg-white/80 p-5 rounded-2xl border border-[#42a5f5]/20 italic text-base text-[#42a5f5] font-black shadow-sm">
                      " {result.tip} "
                    </div>
                  </div>
                </div>
              </div>

              {/* Global Market Analysis */}
              <div className="bg-white/90 backdrop-blur-sm rounded-[2rem] p-8 border-2 border-[#dadce0] shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Globe className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-[#3c4043]">해외 시세 (참고용)</h4>
                    <div className="text-xs font-bold text-[#70757a]">Global Market Reference</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center p-4 bg-[#f8f9fa] rounded-2xl border border-[#dadce0]">
                    <span className="text-sm font-black text-[#3c4043]">Amazon US</span>
                    <span className="text-xl font-black text-blue-600">
                      {result.globalPrices.amazon ? `$${result.globalPrices.amazon}` : '정보 없음'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-[#f8f9fa] rounded-2xl border border-[#dadce0]">
                    <span className="text-sm font-black text-[#3c4043]">BrickLink (신품)</span>
                    <span className="text-xl font-black text-blue-600">
                      {result.globalPrices.bricklink ? `$${result.globalPrices.bricklink}` : '정보 없음'}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-[10px] font-bold text-[#70757a] text-center italic">
                  * 해외 시세는 배송비와 관세가 포함되지 않은 순수 상품 가격입니다.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-16 py-10 border-t-2 border-[#dadce0] text-center">
          <p className="text-xs font-bold text-[#70757a] mb-6 max-w-lg mx-auto leading-relaxed">
            Google Search 기반 실시간 데이터 분석 결과입니다. 실제 가격은 쇼핑몰 상황에 따라 다를 수 있습니다.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="px-4 py-2 bg-white border border-[#dadce0] rounded-xl text-[11px] font-black text-[#3c4043] shadow-sm">MISB 기준</div>
            <div className="px-4 py-2 bg-white border border-[#dadce0] rounded-xl text-[11px] font-black text-[#3c4043] shadow-sm">실시간 트렌드</div>
            <div className="px-4 py-2 bg-white border border-[#dadce0] rounded-xl text-[11px] font-black text-[#3c4043] shadow-sm">단종 리스크 포함</div>
          </div>
        </footer>
      </main>
    </div>
  );
}
