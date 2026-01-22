
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Zap, 
  PlayCircle, 
  StopCircle, 
  Settings, 
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2
} from "lucide-react";

const FullAutomationController = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scheduleType, setScheduleType] = useState<string>('manual');
  const [automationEnabled, setAutomationEnabled] = useState(false);

  const executeFullTransfer = async () => {
    setIsProcessing(true);
    try {
      toast.info('🚀 Initiating comprehensive USD transfer across entire database...');
      
      const { data, error } = await supabase.functions.invoke('comprehensive-usd-aggregator', {
        body: { triggered_by: 'manual_full_transfer' }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`✅ SUCCESS: $${data.total_transferred?.toFixed(2)} transferred to all external accounts!`);
        toast.success(`💰 Breakdown: ${Object.entries(data.breakdown || {}).map(([k, v]: [string, any]) => `${k}: $${v.toFixed(2)}`).join(', ')}`);
      } else {
        toast.error(data?.message || 'Transfer failed');
      }
    } catch (error: any) {
      console.error('Full transfer error:', error);
      toast.error(`Transfer failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const scheduleAutomation = async () => {
    try {
      toast.info(`Setting up ${scheduleType} automated transfers...`);
      
      const { data, error } = await supabase.functions.invoke('automated-full-transfer-scheduler', {
        body: { 
          schedule_type: scheduleType,
          action: 'setup_schedule'
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setAutomationEnabled(true);
        toast.success(`🤖 Automated ${scheduleType} transfers enabled!`);
        if (data.next_scheduled_run) {
          toast.info(`Next run: ${new Date(data.next_scheduled_run).toLocaleString()}`);
        }
      } else {
        toast.error(data?.message || 'Failed to setup automation');
      }
    } catch (error: any) {
      console.error('Automation setup error:', error);
      toast.error(`Automation setup failed: ${error.message}`);
    }
  };

  const stopAutomation = () => {
    setAutomationEnabled(false);
    toast.success('🛑 Automated transfers stopped');
  };

  return (
    <div className="space-y-6">
      {/* Main Control Panel */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-800/20 border-purple-500/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-purple-400 flex items-center justify-center">
            <Zap className="h-8 w-8 mr-2" />
            Full Database USD Automation
          </CardTitle>
          <CardDescription className="text-purple-200">
            Automatically transfer ALL USD from every table to your external accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manual Transfer */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <PlayCircle className="h-5 w-5 mr-2" />
              Manual Full Transfer
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Instantly transfer ALL USD from your entire database to Stripe, PayPal, bank accounts, and Modern Treasury
            </p>
            <Button
              onClick={executeFullTransfer}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              size="lg"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ArrowUpRight className="h-5 w-5 mr-2" />
              )}
              {isProcessing ? 'Processing Full Transfer...' : 'Execute Full Database Transfer'}
            </Button>
          </div>

          {/* Automation Schedule */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Automated Schedule
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Schedule Type</label>
                <Select value={scheduleType} onValueChange={setScheduleType}>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Only</SelectItem>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                {!automationEnabled ? (
                  <Button
                    onClick={scheduleAutomation}
                    disabled={scheduleType === 'manual'}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Enable Automation
                  </Button>
                ) : (
                  <Button
                    onClick={stopAutomation}
                    variant="destructive"
                    className="flex-1"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Stop Automation
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Status Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 text-green-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Automation Status</p>
                  <Badge className={automationEnabled ? 'bg-green-600' : 'bg-gray-600'}>
                    {automationEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-blue-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Schedule</p>
                  <p className="text-white font-medium capitalize">{scheduleType}</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-purple-400 mr-2" />
                <div>
                  <p className="text-xs text-slate-400">Target Accounts</p>
                  <p className="text-white font-medium">All External</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature List */}
          <div className="p-4 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-lg border border-indigo-500/20">
            <h4 className="text-sm font-semibold text-indigo-400 mb-2">What This Automation Does:</h4>
            <ul className="text-xs text-indigo-200 space-y-1">
              <li>• Scans ALL database tables for USD balances</li>
              <li>• Transfers to Stripe, PayPal, bank accounts, Modern Treasury</li>
              <li>• Zeros out all source balances after successful transfer</li>
              <li>• Comprehensive logging and error handling</li>
              <li>• No manual intervention required</li>
              <li>• Full audit trail for compliance</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Warning Notice */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-red-900/20 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-orange-400 mr-3 mt-0.5" />
            <div>
              <h4 className="text-orange-400 font-medium">Important Notice</h4>
              <p className="text-orange-200 text-sm mt-1">
                This system will transfer ALL USD from your entire database to external accounts. 
                Ensure your Stripe, PayPal, and bank account details are correctly configured before enabling automation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FullAutomationController;
