
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Zap, 
  TrendingUp, 
  Target, 
  Activity,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  Settings,
  Cpu
} from "lucide-react";

interface OptimizationResult {
  id: string;
  type: string;
  strategy: string;
  impact: number;
  optimization_id: string;
  status: 'pending' | 'applied' | 'reverted';
  created_at: string;
  metadata?: any;
  performance_metrics?: any;
}

const RevenueOptimizer = () => {
  const [optimizations, setOptimizations] = useState<OptimizationResult[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationStats, setOptimizationStats] = useState({
    total_improvements: 0,
    avg_impact: 0,
    success_rate: 0
  });

  useEffect(() => {
    loadOptimizations();
    const interval = setInterval(loadOptimizations, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOptimizations = async () => {
    try {
      const { data, error } = await supabase
        .from('autonomous_revenue_optimization')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data) {
        // Transform the data to match our interface
        const transformedData: OptimizationResult[] = data.map(item => ({
          id: item.id,
          type: item.optimization_type,
          strategy: item.optimization_type,
          impact: item.success_rate || 0,
          optimization_id: item.id,
          status: item.status as 'pending' | 'applied' | 'reverted',
          created_at: item.created_at,
          metadata: item.metadata,
          performance_metrics: item.performance_metrics
        }));

        setOptimizations(transformedData);

        // Calculate stats
        const totalImprovements = transformedData.filter(o => o.status === 'applied').length;
        const avgImpact = transformedData.reduce((sum, o) => sum + (o.impact || 0), 0) / transformedData.length;
        const successRate = (totalImprovements / transformedData.length) * 100;

        setOptimizationStats({
          total_improvements: totalImprovements,
          avg_impact: avgImpact || 0,
          success_rate: successRate || 0
        });
      }
    } catch (error) {
      console.error('Error loading optimizations:', error);
    }
  };

  const runOptimization = async () => {
    setIsOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('revenue-optimizer', {
        body: { action: 'optimize_all' }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`🚀 Optimization complete! Applied ${data.optimizations_applied} improvements`);
        loadOptimizations();
      } else {
        toast.error(data?.message || 'Optimization failed');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      toast.error('Failed to run optimization');
    } finally {
      setIsOptimizing(false);
    }
  };

  const revertOptimization = async (optimizationId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('revenue-optimizer', {
        body: { 
          action: 'revert',
          optimization_id: optimizationId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Optimization reverted successfully');
        loadOptimizations();
      } else {
        toast.error(data?.message || 'Failed to revert optimization');
      }
    } catch (error) {
      console.error('Revert error:', error);
      toast.error('Failed to revert optimization');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Revenue Optimization Engine
          </CardTitle>
          <CardDescription>
            AI-powered system for maximizing revenue performance across all streams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-800/20 p-4 rounded-lg border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-100 text-sm">Total Improvements</span>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-green-400">
                {optimizationStats.total_improvements}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-800/20 p-4 rounded-lg border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100 text-sm">Avg Impact</span>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">
                +{optimizationStats.avg_impact.toFixed(1)}%
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/20 to-pink-800/20 p-4 rounded-lg border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-100 text-sm">Success Rate</span>
                <Target className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {optimizationStats.success_rate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mb-6">
            <Button
              onClick={runOptimization}
              disabled={isOptimizing}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 w-full"
              size="lg"
            >
              {isOptimizing ? (
                <Activity className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Zap className="h-5 w-5 mr-2" />
              )}
              {isOptimizing ? 'Optimizing Revenue Streams...' : 'RUN MAXIMUM OPTIMIZATION'}
            </Button>
          </div>

          {/* Recent Optimizations */}
          <div>
            <h3 className="text-white font-medium mb-4 flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Recent Optimizations
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {optimizations.map((optimization) => (
                <div 
                  key={optimization.id}
                  className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-600"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-2 h-2 rounded-full ${
                      optimization.status === 'applied' ? 'bg-green-400' :
                      optimization.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'
                    }`}></div>
                    <div>
                      <p className="text-white font-medium capitalize">
                        {optimization.type.replace('_', ' ')}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {optimization.metadata?.description || 'Performance optimization'} • 
                        {new Date(optimization.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-green-400 font-medium flex items-center">
                        <ArrowUp className="h-3 w-3 mr-1" />
                        +{optimization.impact?.toFixed(1) || '0.0'}%
                      </div>
                      <Badge 
                        variant={optimization.status === 'applied' ? 'default' : 'secondary'}
                        className={
                          optimization.status === 'applied' ? 'bg-green-600' :
                          optimization.status === 'pending' ? 'bg-yellow-600' : 'bg-red-600'
                        }
                      >
                        {optimization.status}
                      </Badge>
                    </div>
                    {optimization.status === 'applied' && (
                      <Button
                        onClick={() => revertOptimization(optimization.optimization_id)}
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-400 hover:bg-red-400/10"
                      >
                        Revert
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {optimizations.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No optimizations yet. Run your first optimization to get started!</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueOptimizer;
