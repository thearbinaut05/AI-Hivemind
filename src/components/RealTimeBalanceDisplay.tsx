import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  DollarSign, 
  RefreshCw, 
  TrendingUp, 
  ArrowUpRight,
  Banknote,
  CreditCard,
  Activity,
  CheckCircle,
  AlertCircle,
  Wrench,
  Zap
} from "lucide-react";
import { useNavigate } from 'react-router-dom';

interface BalanceData {
  application_balance: number;
  stripe_balance: number;
  pending_transfers: number;
  total_revenue: number;
  last_updated: string;
  stripe_available: any[];
  transfer_ready: boolean;
}

const RealTimeBalanceDisplay = () => {
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBalances();
    const interval = setInterval(loadBalances, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadBalances = async () => {
    try {
      // Get application balance
      const { data: appBalance } = await supabase
        .from('application_balance')
        .select('*')
        .maybeSingle();

      // Get total revenue from completed transactions
      const { data: transactions } = await supabase
        .from('autonomous_revenue_transactions')
        .select('amount, status')
        .eq('status', 'completed');

      const totalRevenue = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
      const applicationBalance = appBalance?.balance_amount || 0;
      const pendingTransfers = appBalance?.pending_transfers || 0;

      // Check if we can get Stripe balance (this requires proper integration)
      let stripeBalanceData = null;
      try {
        const { data: stripeResponse } = await supabase.functions.invoke('get-stripe-balance');
        if (stripeResponse?.success) {
          stripeBalanceData = stripeResponse;
        }
      } catch (error) {
        console.log('Stripe balance check not available yet');
      }

      // Calculate total transferable amount (application balance + revenue)
      const totalTransferAmount = applicationBalance + totalRevenue;

      setBalances({
        application_balance: applicationBalance,
        stripe_balance: stripeBalanceData?.balance || 0,
        pending_transfers: pendingTransfers,
        total_revenue: totalRevenue,
        last_updated: new Date().toISOString(),
        stripe_available: stripeBalanceData?.available || [],
        transfer_ready: totalTransferAmount >= 5
      });

    } catch (error) {
      console.error('Error loading balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    setRefreshing(true);
    await loadBalances();
    setRefreshing(false);
    toast.success('Balances refreshed!');
  };

  const executeTransfer = async () => {
    setTransferring(true);
    try {
      toast.info('📊 Step 1: Moving revenue to application balance...');
      
      if (balances?.total_revenue && balances.total_revenue > 0) {
        const { error: revenueTransferError } = await supabase
          .from('application_balance')
          .update({ 
            balance_amount: (balances.application_balance || 0) + balances.total_revenue,
            last_updated_at: new Date().toISOString()
          })
          .eq('id', 1);

        if (revenueTransferError) {
          throw new Error(`Failed to move revenue: ${revenueTransferError.message}`);
        }

        await supabase
          .from('autonomous_revenue_transactions')
          .update({ status: 'transferred' })
          .eq('status', 'completed');
      }

      toast.info('🏦 Step 2: Transferring to bank account...');
      const { data, error } = await supabase.functions.invoke('stripe-revenue-transfer');
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`🎉 Successfully transferred $${data.amount?.toFixed(2)} to your bank account!`);
        await loadBalances();
      } else if (data?.balance_unchanged) {
        toast.error(data?.message || 'Transfer failed - balance unchanged');
      } else {
        toast.info(data?.message || 'No funds available for transfer');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('Transfer failed - please check your Stripe configuration');
      await loadBalances();
    } finally {
      setTransferring(false);
    }
  };

  const fixFailedTransfers = async () => {
    try {
      toast.info('🔧 Checking and fixing failed transfers...');
      const { data, error } = await supabase.functions.invoke('fix-failed-transfers');
      
      if (error) throw error;
      
      if (data?.success) {
        if (data.fixed > 0) {
          toast.success(`✅ Fixed ${data.fixed} failed transfers! Total recovered: $${(data.total_amount_recovered / 100).toFixed(2)}`);
        } else {
          toast.info('✨ No failed transfers found to fix - everything looks good!');
        }
        await loadBalances();
      } else {
        toast.error(data?.message || 'Failed to fix transfers');
      }
    } catch (error) {
      console.error('Fix failed transfers error:', error);
      toast.error('Failed to run transfer fix workflow');
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center p-8">
          <Activity className="h-6 w-6 animate-spin mr-2" />
          <span>Loading real-time balances...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Real-Time Balance Monitor</h3>
        <div className="flex gap-2">
          <Button
            onClick={refreshBalances}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="bg-slate-700 border-slate-600 hover:bg-slate-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={fixFailedTransfers}
            variant="outline"
            size="sm"
            className="bg-orange-700 border-orange-600 hover:bg-orange-600"
          >
            <Wrench className="h-4 w-4 mr-2" />
            Fix Failed
          </Button>
          <Button
            onClick={async () => {
              try {
                toast.info('Transferring ALL USD from entire database...');
                const { data, error } = await supabase.functions.invoke('comprehensive-usd-aggregator', { body: {} });
                if (error) throw error;
                if (data?.success) {
                  toast.success(`🎉 SUCCESS: $${data.total_transferred?.toFixed(2)} transferred from entire database!`);
                  await loadBalances();
                } else {
                  toast.error(data?.message || 'Full database transfer failed');
                }
              } catch (e) {
                console.error(e);
                toast.error('Full database transfer failed');
              }
            }}
            variant="outline"
            size="sm"
            className="bg-purple-700 border-purple-600 hover:bg-purple-600"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Full DB Transfer
          </Button>
          <Button
            onClick={async () => {
              try {
                toast.info('Aggregating USD across tables and transferring from Stripe...');
                const { data, error } = await supabase.functions.invoke('aggregate-usd-to-stripe', { body: {} });
                if (error) throw error;
                if (data?.success) {
                  toast.success(data.message || 'Aggregate transfer completed');
                  await loadBalances();
                } else {
                  toast.error(data?.message || 'Aggregate transfer failed');
                }
              } catch (e) {
                console.error(e);
                toast.error('Aggregate transfer failed. Check Edge Function logs.');
              }
            }}
            variant="outline"
            size="sm"
            className="bg-teal-700 border-teal-600 hover:bg-teal-600"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Aggregate USD
          </Button>
          <Button
            onClick={async () => {
              try {
                toast.info('Creating Stripe payout to your bank...');
                const { data, error } = await supabase.functions.invoke('payout-now', { body: {} });
                if (error) throw error;
                if (data?.success) {
                  toast.success(data.message || 'Payout created');
                  await loadBalances();
                } else {
                  toast.error(data?.message || 'Payout failed');
                }
              } catch (e) {
                console.error(e);
                toast.error('Payout failed. Check Edge Function logs.');
              }
            }}
            variant="outline"
            size="sm"
            className="bg-green-700 border-green-600 hover:bg-green-600"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Payout to Bank
          </Button>
          <Button
            onClick={() => navigate('/cash-out')}
            variant="outline"
            size="sm"
            className="bg-purple-700 border-purple-600 hover:bg-purple-600"
          >
            <Banknote className="h-4 w-4 mr-2" />
            Full Cash Out
          </Button>
          <Button
            onClick={() => navigate('/full-automation')}
            variant="outline"
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            Full Automation
          </Button>
          <Button
            onClick={executeTransfer}
            disabled={transferring || !balances?.transfer_ready}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            size="sm"
          >
            {transferring ? (
              <Activity className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowUpRight className="h-4 w-4 mr-2" />
            )}
            Transfer to Bank
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Application Balance */}
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-800/20 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-100">Application Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              ${balances?.application_balance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-green-200 mt-1">
              Ready for transfer
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-800/20 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              ${balances?.total_revenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-blue-200 mt-1">
              From all transactions
            </p>
          </CardContent>
        </Card>

        {/* Stripe Balance */}
        <Card className="bg-gradient-to-br from-purple-900/20 to-pink-800/20 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-100">Stripe Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              ${balances?.stripe_balance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-purple-200 mt-1">
              Available in Stripe
            </p>
          </CardContent>
        </Card>

        {/* Transfer Status */}
        <Card className="bg-gradient-to-br from-orange-900/20 to-red-800/20 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-100">Transfer Status</CardTitle>
            {balances?.transfer_ready ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-orange-400" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-400">
              {balances?.transfer_ready ? 'READY' : 'WAITING'}
            </div>
            <p className="text-xs text-orange-200 mt-1">
              {balances?.transfer_ready ? 'Above $5 minimum' : 'Below $5 minimum'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Details */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Banknote className="h-5 w-5 mr-2" />
            Transfer Details & Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Total Transfer Amount</p>
              <p className="text-white font-semibold">
                ${((balances?.application_balance || 0) + (balances?.total_revenue || 0)).toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">
                App: ${(balances?.application_balance || 0).toFixed(2)} + Revenue: ${(balances?.total_revenue || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Pending Transfers</p>
              <p className="text-white font-semibold">
                ${balances?.pending_transfers?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Last Updated</p>
              <p className="text-white font-semibold text-xs">
                {balances?.last_updated ? new Date(balances.last_updated).toLocaleTimeString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Stripe Status</p>
              <Badge className={balances?.stripe_available?.length > 0 ? 'bg-green-600' : 'bg-yellow-600'}>
                {balances?.stripe_available?.length > 0 ? 'Connected' : 'Setup Required'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Configuration Notice */}
      {(!balances?.stripe_available || balances.stripe_available.length === 0) && (
        <Card className="bg-yellow-900/20 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
              <div>
                <p className="text-yellow-100 font-medium">Stripe Configuration Required</p>
                <p className="text-yellow-200 text-sm">
                  Please configure your Stripe secret key in the Edge Function secrets to enable real-time balance monitoring and transfers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealTimeBalanceDisplay;
