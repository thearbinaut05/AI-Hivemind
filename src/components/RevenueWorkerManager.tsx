
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, 
  Cpu, 
  Activity, 
  Zap,
  Settings,
  BarChart3,
  ArrowUpRight,
  Timer,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface Worker {
  id: string;
  worker_type: string;
  status: string;
  last_heartbeat: string;
  metrics: any;
  config: any;
}

interface WorkerPool {
  id: string;
  worker_type: string;
  current_workers: number;
  max_workers: number;
  status: string;
  config: any;
}

const RevenueWorkerManager = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerPools, setWorkerPools] = useState<WorkerPool[]>([]);
  const [scaling, setScaling] = useState(false);
  const [autoScale, setAutoScale] = useState(true);

  useEffect(() => {
    loadWorkerData();
    const interval = setInterval(loadWorkerData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scaling runs every 15 seconds
  useEffect(() => {
    if (autoScale) {
      const interval = setInterval(autoScaleWorkers, 15000);
      return () => clearInterval(interval);
    }
  }, [autoScale]);

  const loadWorkerData = async () => {
    try {
      const [workersResponse, poolsResponse] = await Promise.all([
        supabase.from('autonomous_revenue_workers').select('*').order('created_at', { ascending: false }),
        supabase.from('autonomous_revenue_worker_pool').select('*').order('worker_type')
      ]);

      setWorkers(workersResponse.data || []);
      setWorkerPools(poolsResponse.data || []);
    } catch (error) {
      console.error('Error loading worker data:', error);
    }
  };

  const autoScaleWorkers = async () => {
    try {
      // Get pending tasks count
      const { data: tasks } = await supabase
        .from('autonomous_revenue_task_queue')
        .select('*')
        .eq('status', 'pending');

      const pendingTasks = tasks?.length || 0;
      
      // Scale based on task load
      for (const pool of workerPools) {
        const optimalWorkers = Math.min(
          pool.max_workers,
          Math.max(1, Math.ceil(pendingTasks / 10))
        );

        if (optimalWorkers !== pool.current_workers) {
          await supabase
            .from('autonomous_revenue_worker_pool')
            .update({
              current_workers: optimalWorkers,
              config: {
                ...pool.config,
                last_scaled: new Date().toISOString(),
                scale_reason: `Task load: ${pendingTasks}`
              }
            })
            .eq('id', pool.id);
        }
      }

      // Spawn new workers if needed
      const activeWorkers = workers.filter(w => w.status === 'active').length;
      const totalOptimal = workerPools.reduce((sum, pool) => sum + pool.current_workers, 0);

      if (activeWorkers < totalOptimal) {
        await spawnWorkers(totalOptimal - activeWorkers);
      }

    } catch (error) {
      console.error('Auto-scaling error:', error);
    }
  };

  const spawnWorkers = async (count: number) => {
    const workerTypes = ['transfer', 'optimization', 'analysis'];
    
    for (let i = 0; i < count; i++) {
      const workerType = workerTypes[i % workerTypes.length];
      
      await supabase
        .from('autonomous_revenue_workers')
        .insert({
          worker_type: workerType,
          status: 'active',
          config: {
            auto_spawned: true,
            spawn_time: new Date().toISOString(),
            optimization_level: 'maximum'
          },
          metrics: {
            tasks_completed: 0,
            revenue_processed: 0,
            efficiency_score: 1.0
          }
        });
    }
  };

  const scaleWorkerPool = async (poolId: string, direction: 'up' | 'down') => {
    setScaling(true);
    try {
      const pool = workerPools.find(p => p.id === poolId);
      if (!pool) return;

      const newCount = direction === 'up' 
        ? Math.min(pool.max_workers, pool.current_workers + 5)
        : Math.max(1, pool.current_workers - 2);

      await supabase
        .from('autonomous_revenue_worker_pool')
        .update({
          current_workers: newCount,
          config: {
            ...pool.config,
            manual_scaled: true,
            scaled_at: new Date().toISOString()
          }
        })
        .eq('id', poolId);

      if (direction === 'up') {
        await spawnWorkers(5);
        toast.success(`Scaled up ${pool.worker_type} workers to ${newCount}`);
      } else {
        toast.success(`Scaled down ${pool.worker_type} workers to ${newCount}`);
      }

      loadWorkerData();
    } catch (error) {
      console.error('Scaling error:', error);
      toast.error('Failed to scale workers');
    } finally {
      setScaling(false);
    }
  };

  const totalWorkers = workers.length;
  const activeWorkers = workers.filter(w => w.status === 'active').length;
  const totalRevenue = workers.reduce((sum, w) => sum + (w.metrics?.revenue_processed || 0), 0);
  const avgEfficiency = workers.reduce((sum, w) => sum + (w.metrics?.efficiency_score || 0), 0) / totalWorkers || 0;

  return (
    <div className="space-y-6">
      {/* Worker Overview */}
      <Card className="bg-gradient-to-br from-blue-900/20 to-indigo-800/20 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-2xl text-blue-400 flex items-center">
            <Users className="h-8 w-8 mr-2" />
            Revenue Worker Management
          </CardTitle>
          <CardDescription className="text-blue-200">
            Manage and scale autonomous revenue processing workers for maximum profitability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Active Workers</p>
                  <p className="text-xl font-bold text-blue-400">{activeWorkers}</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <Cpu className="h-5 w-5 text-green-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Total Workers</p>
                  <p className="text-xl font-bold text-green-400">{totalWorkers}</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <BarChart3 className="h-5 w-5 text-purple-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Revenue Processed</p>
                  <p className="text-xl font-bold text-purple-400">${totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <Activity className="h-5 w-5 text-orange-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Avg Efficiency</p>
                  <p className="text-xl font-bold text-orange-400">{(avgEfficiency * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-Scaling Control */}
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setAutoScale(!autoScale)}
                variant={autoScale ? "default" : "outline"}
                className={autoScale ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Scale: {autoScale ? 'ON' : 'OFF'}
              </Button>
            </div>
            
            <Badge className={`${autoScale ? 'bg-green-600' : 'bg-gray-600'} animate-pulse`}>
              {autoScale ? 'ACTIVELY SCALING' : 'MANUAL MODE'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Worker Pools */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Worker Pools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workerPools.map((pool) => (
              <div key={pool.id} className="p-4 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-medium capitalize">
                      {pool.worker_type.replace('_', ' ')} Workers
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {pool.current_workers} / {pool.max_workers} workers active
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => scaleWorkerPool(pool.id, 'down')}
                      disabled={scaling || pool.current_workers <= 1}
                      variant="outline"
                      size="sm"
                    >
                      Scale Down
                    </Button>
                    <Button
                      onClick={() => scaleWorkerPool(pool.id, 'up')}
                      disabled={scaling || pool.current_workers >= pool.max_workers}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      Scale Up
                    </Button>
                  </div>
                </div>
                
                <Progress 
                  value={(pool.current_workers / pool.max_workers) * 100} 
                  className="mb-2"
                />
                
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Utilization: {((pool.current_workers / pool.max_workers) * 100).toFixed(1)}%</span>
                  <Badge className={pool.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}>
                    {pool.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Workers */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Active Workers ({activeWorkers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {workers.filter(w => w.status === 'active').slice(0, 12).map((worker) => (
              <div key={worker.id} className="p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium capitalize">
                    {worker.worker_type.replace('_', ' ')}
                  </h4>
                  <Badge className={
                    worker.status === 'active' ? 'bg-green-600' :
                    worker.status === 'processing' ? 'bg-blue-600' : 'bg-gray-600'
                  }>
                    {worker.status}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tasks Completed</span>
                    <span className="text-white">{worker.metrics?.tasks_completed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Revenue Processed</span>
                    <span className="text-green-400">${(worker.metrics?.revenue_processed || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Efficiency</span>
                    <span className="text-blue-400">{((worker.metrics?.efficiency_score || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Heartbeat</span>
                    <span className="text-white">
                      {worker.last_heartbeat ? new Date(worker.last_heartbeat).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueWorkerManager;
