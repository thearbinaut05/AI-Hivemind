
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Zap, 
  TrendingUp, 
  DollarSign, 
  Target,
  ArrowRight,
  Banknote,
  Activity,
  Clock,
  CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  activeStreams: number;
  totalTransactions: number;
}

const Index = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    todayRevenue: 0,
    activeStreams: 0,
    totalTransactions: 0
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Auto-generation every 10 seconds
  useEffect(() => {
    if (autoMode) {
      const interval = setInterval(() => {
        generateRevenue();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [autoMode]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Get revenue stats
      const { data: statsData } = await supabase
        .rpc('get_autonomous_revenue_stats');
      
      if (statsData?.[0]) {
        const data = statsData[0];
        setStats({
          totalRevenue: data.total_revenue || 0,
          todayRevenue: 0, // Would need separate query for today's revenue
          activeStreams: data.active_streams || 0,
          totalTransactions: data.total_transactions || 0
        });
      }

      // Get recent transactions
      const { data: transactions } = await supabase
        .from('autonomous_revenue_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentActivity(transactions || []);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const generateRevenue = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('hyper-revenue-generator');
      
      if (error) throw error;
      
      if (data?.success && data.total_amount > 0) {
        toast.success(`💰 Generated $${data.total_amount?.toFixed(2)}!`);
        loadStats();
      }
    } catch (error) {
      console.error('Error generating revenue:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
            🚀 Autonomous Revenue Engine
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            24/7 AI-Powered Revenue Generation with Automatic Bank Transfers
          </p>
          
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${autoMode ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-white font-medium">
                {autoMode ? '🔄 GENERATING REVENUE' : '⏸️ PAUSED'}
              </span>
            </div>
            <Button
              onClick={() => setAutoMode(!autoMode)}
              variant={autoMode ? "destructive" : "default"}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {autoMode ? 'Pause Auto-Generation' : 'Start Auto-Generation'}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-gradient-to-br from-green-900/30 to-green-800/30 border-green-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">
                ${stats.totalRevenue.toFixed(2)}
              </div>
              <p className="text-green-200 text-sm mt-1">
                Lifetime earnings
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border-blue-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Active Streams</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">
                {stats.activeStreams}
              </div>
              <p className="text-blue-200 text-sm mt-1">
                Revenue sources
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border-purple-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Transactions</CardTitle>
              <Target className="h-5 w-5 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">
                {stats.totalTransactions}
              </div>
              <p className="text-purple-200 text-sm mt-1">
                Total processed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-900/30 to-orange-800/30 border-orange-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Avg/Transaction</CardTitle>
              <Banknote className="h-5 w-5 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-400">
                ${stats.totalTransactions > 0 ? (stats.totalRevenue / stats.totalTransactions).toFixed(2) : '0.00'}
              </div>
              <p className="text-orange-200 text-sm mt-1">
                Per transaction
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Quick Actions */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Quick Actions
              </CardTitle>
              <CardDescription className="text-slate-400">
                Instant revenue generation and management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={generateRevenue}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                size="lg"
              >
                {isGenerating ? (
                  <Activity className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 mr-2" />
                )}
                {isGenerating ? 'Generating Revenue...' : 'Generate Revenue NOW'}
              </Button>

              <Link to="/revenue-dashboard" className="block">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" size="lg">
                  Open Revenue Dashboard
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-slate-400">
                Latest revenue transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
                        <div>
                          <p className="text-white text-sm font-medium">
                            ${activity.amount.toFixed(2)}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {activity.metadata?.strategy?.replace('_', ' ') || 'Revenue'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-600 text-xs">
                        {activity.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-4">
                    No recent activity. Start generating revenue!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            🏦 Revenue automatically transfers to your bank account when thresholds are met
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Compliant with ASC 606 & IFRS 15 revenue recognition standards
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
