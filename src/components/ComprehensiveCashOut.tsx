
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  DollarSign, 
  ArrowUpRight, 
  RefreshCw, 
  Banknote,
  CreditCard,
  Building,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

interface TransferableAmounts {
  application_balance: number;
  autonomous_revenue: number;
  earnings: number;
  consolidated_balances: number;
  consolidated_amounts: number;
  pending_transfers: number;
  total_transferable: number;
  breakdown: Array<{
    source: string;
    amount: number;
    description: string;
  }>;
}

const ComprehensiveCashOut = () => {
  const [amounts, setAmounts] = useState<TransferableAmounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [transferMethod, setTransferMethod] = useState<'stripe' | 'paypal'>('stripe');

  useEffect(() => {
    loadTransferableAmounts();
    const interval = setInterval(loadTransferableAmounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTransferableAmounts = async () => {
    try {
      console.log('Loading transferable amounts from all database tables...');
      
      // Get application balance
      const { data: appBalance } = await supabase
        .from('application_balance')
        .select('*')
        .maybeSingle();

      // Get autonomous revenue transactions
      const { data: autonomousRevenue } = await supabase
        .from('autonomous_revenue_transactions')
        .select('amount, status, currency')
        .eq('status', 'completed');

      // Get earnings
      const { data: earnings } = await supabase
        .from('earnings')
        .select('amount');

      // Get consolidated balances
      const { data: consolidatedBalances } = await supabase
        .from('consolidated_balances')
        .select('amount, currency')
        .eq('currency', 'USD');

      // Get consolidated amounts
      const { data: consolidatedAmounts } = await supabase
        .from('consolidated_amounts')
        .select('total_usd, status')
        .eq('status', 'ready_for_transfer');

      // Get pending transfers to subtract
      const { data: pendingTransfers } = await supabase
        .from('autonomous_revenue_transfers')
        .select('amount')
        .eq('status', 'pending');

      // Calculate totals
      const appBalanceAmount = appBalance?.balance_amount || 0;
      const autonomousRevenueAmount = (autonomousRevenue || [])
        .filter(t => (t.currency || 'USD').toUpperCase() === 'USD')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const earningsAmount = (earnings || []).reduce((sum, e) => sum + Number(e.amount), 0);
      const consolidatedBalancesAmount = (consolidatedBalances || [])
        .reduce((sum, b) => sum + Number(b.amount), 0);
      const consolidatedAmountsTotal = (consolidatedAmounts || [])
        .reduce((sum, a) => sum + Number(a.total_usd), 0);
      const pendingTransfersAmount = (pendingTransfers || [])
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalTransferable = Math.max(0, 
        appBalanceAmount + 
        autonomousRevenueAmount + 
        earningsAmount + 
        consolidatedBalancesAmount + 
        consolidatedAmountsTotal - 
        pendingTransfersAmount
      );

      const breakdown = [
        {
          source: 'application_balance',
          amount: appBalanceAmount,
          description: 'Main application balance ready for transfer'
        },
        {
          source: 'autonomous_revenue_transactions',
          amount: autonomousRevenueAmount,
          description: 'Completed autonomous revenue transactions'
        },
        {
          source: 'earnings',
          amount: earningsAmount,
          description: 'User earnings from campaigns and activities'
        },
        {
          source: 'consolidated_balances',
          amount: consolidatedBalancesAmount,
          description: 'Consolidated USD balances'
        },
        {
          source: 'consolidated_amounts',
          amount: consolidatedAmountsTotal,
          description: 'Ready-to-transfer consolidated amounts'
        }
      ].filter(item => item.amount > 0);

      setAmounts({
        application_balance: appBalanceAmount,
        autonomous_revenue: autonomousRevenueAmount,
        earnings: earningsAmount,
        consolidated_balances: consolidatedBalancesAmount,
        consolidated_amounts: consolidatedAmountsTotal,
        pending_transfers: pendingTransfersAmount,
        total_transferable: totalTransferable,
        breakdown
      });

      console.log('Transferable amounts loaded:', {
        total: totalTransferable,
        breakdown: breakdown.length
      });

    } catch (error) {
      console.error('Error loading transferable amounts:', error);
      toast.error('Failed to load transferable amounts');
    } finally {
      setLoading(false);
    }
  };

  const executeTransfer = async (amount?: number) => {
    if (!amounts || amounts.total_transferable <= 0) {
      toast.error('No funds available for transfer');
      return;
    }

    const transferAmount = amount || amounts.total_transferable;
    
    if (transferAmount > amounts.total_transferable) {
      toast.error('Transfer amount exceeds available balance');
      return;
    }

    if (transferAmount < 5) {
      toast.error('Minimum transfer amount is $5.00');
      return;
    }

    setTransferring(true);
    
    try {
      console.log(`Initiating ${transferMethod} transfer for $${transferAmount.toFixed(2)}`);

      if (transferMethod === 'stripe') {
        // Step 1: Aggregate all USD amounts and move to Stripe
        toast.info('Step 1: Aggregating USD across all tables...');
        const { data: aggregateData, error: aggregateError } = await supabase.functions
          .invoke('aggregate-usd-to-stripe', { 
            body: { amount_cents: Math.round(transferAmount * 100) }
          });

        if (aggregateError) throw aggregateError;

        if (aggregateData?.success) {
          toast.success(`Step 1 Complete: $${(aggregateData.amount_cents / 100).toFixed(2)} aggregated to Stripe`);
          
          // Step 2: Create payout to bank account
          toast.info('Step 2: Creating payout to your bank account...');
          const { data: payoutData, error: payoutError } = await supabase.functions
            .invoke('payout-now', { 
              body: { amount_cents: aggregateData.amount_cents }
            });

          if (payoutError) throw payoutError;

          if (payoutData?.success) {
            toast.success(`✅ SUCCESS: $${(payoutData.amount_cents / 100).toFixed(2)} payout created!`);
            toast.success(`Funds will arrive: ${new Date(payoutData.arrival_date * 1000).toLocaleDateString()}`);
          } else {
            toast.error(payoutData?.message || 'Payout creation failed');
          }
        } else {
          toast.error(aggregateData?.message || 'Aggregation failed');
        }
      } else {
        // PayPal transfer (placeholder - would need PayPal integration)
        toast.info('PayPal integration coming soon. Using Stripe for now...');
        // Fallback to Stripe transfer
        await executeTransfer(transferAmount);
        return;
      }

      // Refresh amounts after transfer
      await loadTransferableAmounts();
      setCustomAmount('');

    } catch (error: any) {
      console.error('Transfer error:', error);
      toast.error(`Transfer failed: ${error.message || 'Unknown error'}`);
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading transferable amounts from all database tables...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Available */}
      <Card className="bg-gradient-to-br from-green-900/20 to-emerald-800/20 border-green-500/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-green-400 flex items-center justify-center">
            <DollarSign className="h-8 w-8 mr-2" />
            Total Transferable USD
          </CardTitle>
          <div className="text-4xl font-bold text-green-400">
            ${amounts?.total_transferable?.toFixed(2) || '0.00'}
          </div>
          <CardDescription className="text-green-200">
            Available across all database tables
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Breakdown by Source */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            USD Breakdown by Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {amounts?.breakdown?.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div>
                <h4 className="text-white font-medium">{item.source.replace('_', ' ').toUpperCase()}</h4>
                <p className="text-slate-400 text-sm">{item.description}</p>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold text-lg">${item.amount.toFixed(2)}</div>
              </div>
            </div>
          ))}
          
          {amounts?.pending_transfers && amounts.pending_transfers > 0 && (
            <div className="flex items-center justify-between p-3 bg-orange-900/20 rounded-lg border border-orange-500/20">
              <div>
                <h4 className="text-orange-400 font-medium">PENDING TRANSFERS</h4>
                <p className="text-orange-300 text-sm">Currently being processed</p>
              </div>
              <div className="text-orange-400 font-bold text-lg">-${amounts.pending_transfers.toFixed(2)}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Controls */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Banknote className="h-5 w-5 mr-2" />
            Cash Out Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transfer Method Selection */}
          <div className="space-y-2">
            <Label className="text-white">Transfer Method</Label>
            <div className="flex gap-2">
              <Button
                variant={transferMethod === 'stripe' ? 'default' : 'outline'}
                onClick={() => setTransferMethod('stripe')}
                className="flex-1"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Stripe (Bank Account)
              </Button>
              <Button
                variant={transferMethod === 'paypal' ? 'default' : 'outline'}
                onClick={() => setTransferMethod('paypal')}
                className="flex-1"
                disabled
              >
                <Building className="h-4 w-4 mr-2" />
                PayPal (Coming Soon)
              </Button>
            </div>
          </div>

          <Separator />

          {/* Quick Transfer */}
          <div className="space-y-2">
            <Label className="text-white">Quick Transfer</Label>
            <Button
              onClick={() => executeTransfer()}
              disabled={transferring || !amounts || amounts.total_transferable < 5}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              size="lg"
            >
              {transferring ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ArrowUpRight className="h-5 w-5 mr-2" />
              )}
              {transferring ? 'Processing Transfer...' : `Transfer All $${amounts?.total_transferable?.toFixed(2) || '0.00'}`}
            </Button>
          </div>

          <Separator />

          {/* Custom Amount Transfer */}
          <div className="space-y-2">
            <Label className="text-white">Custom Amount</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  min="5"
                  max={amounts?.total_transferable || 0}
                  step="0.01"
                />
              </div>
              <Button
                onClick={() => executeTransfer(parseFloat(customAmount))}
                disabled={transferring || !customAmount || parseFloat(customAmount) < 5 || parseFloat(customAmount) > (amounts?.total_transferable || 0)}
                variant="outline"
              >
                Transfer
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Minimum: $5.00 • Maximum: ${amounts?.total_transferable?.toFixed(2) || '0.00'}
            </p>
          </div>

          {/* Status Messages */}
          {amounts && amounts.total_transferable < 5 && (
            <div className="flex items-center p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
              <div>
                <p className="text-yellow-400 font-medium">Minimum Transfer Not Met</p>
                <p className="text-yellow-300 text-sm">You need at least $5.00 to initiate a transfer</p>
              </div>
            </div>
          )}

          {amounts && amounts.total_transferable >= 5 && (
            <div className="flex items-center p-3 bg-green-900/20 rounded-lg border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
              <div>
                <p className="text-green-400 font-medium">Ready for Transfer</p>
                <p className="text-green-300 text-sm">All funds have been aggregated and are ready to transfer</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button
          onClick={loadTransferableAmounts}
          variant="outline"
          className="bg-slate-700 border-slate-600 hover:bg-slate-600"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Amounts
        </Button>
      </div>
    </div>
  );
};

export default ComprehensiveCashOut;
