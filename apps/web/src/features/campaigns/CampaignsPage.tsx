import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adsApi, socialAccountsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Megaphone,
  Plus,
  RefreshCw,
  Loader2,
  Play,
  Pause,
  Trash2,
  Eye,
  DollarSign,
  BarChart3,
  MousePointerClick,
} from 'lucide-react';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [syncAccountId, setSyncAccountId] = useState<string>('');

  const campaignsQuery = useQuery({
    queryKey: ['ads-campaigns', statusFilter],
    queryFn: () => adsApi.getCampaigns(statusFilter || undefined),
  });

  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
  });

  const syncMutation = useMutation({
    mutationFn: (socialAccountId: string) => adsApi.syncCampaigns(socialAccountId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({
        title: 'Sync complete',
        description: `Synced ${data.synced} campaigns from Meta.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: error.message,
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adsApi.updateCampaignStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campaign updated' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adsApi.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campaign deleted' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
    },
  });

  const campaigns = campaignsQuery.data || [];
  const metaAccounts = (accountsQuery.data || []).filter(
    (a: any) => a.platform === 'FACEBOOK' || a.platform === 'INSTAGRAM',
  );

  // Summary
  const totalSpend = campaigns.reduce((sum: number, c: any) => sum + c.totalSpend, 0);
  const totalImpressions = campaigns.reduce((sum: number, c: any) => sum + c.totalImpressions, 0);
  const totalClicks = campaigns.reduce((sum: number, c: any) => sum + c.totalClicks, 0);
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ad Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your paid advertising across platforms
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {metaAccounts.length > 0 && (
            <div className="flex items-center space-x-2">
              <select
                className="border rounded-md px-3 py-2 text-sm bg-white"
                value={syncAccountId}
                onChange={(e) => setSyncAccountId(e.target.value)}
              >
                <option value="">Select account to sync...</option>
                {metaAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} ({a.platform})
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAccountId && syncMutation.mutate(syncAccountId)}
                disabled={!syncAccountId || syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync from Meta
              </Button>
            </div>
          )}
          <Button asChild>
            <Link to="/campaigns/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {campaigns.length} total campaigns
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalImpressions)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalClicks)}</div>
            <p className="text-xs text-muted-foreground">
              CTR: {totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0'}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {['', 'ACTIVE', 'PAUSED', 'DRAFT', 'COMPLETED'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>

      {/* Campaign List */}
      {campaignsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Megaphone className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No campaigns yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Create your first ad campaign or sync existing ones from Meta.
              </p>
              <Button asChild className="mt-6">
                <Link to="/campaigns/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign: any) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <Link
                        to={`/campaigns/${campaign.id}`}
                        className="text-lg font-semibold hover:text-primary transition-colors"
                      >
                        {campaign.name}
                      </Link>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[campaign.status]}`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                      <span>{campaign.socialAccount?.platform}</span>
                      <span>{campaign.socialAccount?.displayName}</span>
                      <span>Objective: {campaign.objective}</span>
                      <span>
                        Budget: {formatCurrency(campaign.budgetAmount)} / {campaign.budgetType.toLowerCase()}
                      </span>
                    </div>
                    {campaign.post && (
                      <p className="text-sm text-muted-foreground mb-2">
                        📌 Boosted post: &quot;{campaign.post.contentText?.substring(0, 60)}...&quot;
                      </p>
                    )}
                    <div className="grid grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Spend</p>
                        <p className="font-semibold">{formatCurrency(campaign.totalSpend)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                        <p className="font-semibold">{formatNumber(campaign.totalImpressions)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                        <p className="font-semibold">{formatNumber(campaign.totalClicks)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Conversions</p>
                        <p className="font-semibold">{formatNumber(campaign.totalConversions)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/campaigns/${campaign.id}`}>
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    </Button>
                    {campaign.status === 'PAUSED' || campaign.status === 'DRAFT' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMutation.mutate({ id: campaign.id, status: 'ACTIVE' })
                        }
                        disabled={statusMutation.isPending}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : campaign.status === 'ACTIVE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMutation.mutate({ id: campaign.id, status: 'PAUSED' })
                        }
                        disabled={statusMutation.isPending}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this campaign?')) {
                          deleteMutation.mutate(campaign.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
