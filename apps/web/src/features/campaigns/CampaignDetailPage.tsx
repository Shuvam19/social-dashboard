import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { adsApi, analyticsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ArrowLeft,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  DELETED: 'bg-red-100 text-red-700',
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

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();

  const campaignQuery = useQuery({
    queryKey: ['ads-campaign', id],
    queryFn: () => adsApi.getCampaignById(id!),
    enabled: !!id,
  });

  const timeSeriesQuery = useQuery({
    queryKey: ['campaign-timeseries', id],
    queryFn: () => analyticsApi.getCampaignTimeSeries(id!),
    enabled: !!id,
  });

  if (campaignQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const campaign = campaignQuery.data;
  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button asChild className="mt-4">
          <Link to="/campaigns">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const chartData = (timeSeriesQuery.data || campaign.metrics || []).map((m: any) => ({
    date: m.date?.split('T')[0] || m.date,
    spend: (m.spend || 0) / 100,
    impressions: m.impressions || 0,
    clicks: m.clicks || 0,
  }));

  const ctr = campaign.totalImpressions > 0
    ? ((campaign.totalClicks / campaign.totalImpressions) * 100).toFixed(2)
    : '0';
  const cpc = campaign.totalClicks > 0
    ? formatCurrency(Math.round(campaign.totalSpend / campaign.totalClicks))
    : '$0.00';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/campaigns">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${statusColors[campaign.status]}`}
            >
              {campaign.status}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            {campaign.socialAccount?.platform} · {campaign.socialAccount?.displayName} · {campaign.objective}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Budget: {formatCurrency(campaign.budgetAmount)} / {campaign.budgetType?.toLowerCase()} ·
            {' '}Start: {new Date(campaign.startDate).toLocaleDateString()}
            {campaign.endDate && ` · End: ${new Date(campaign.endDate).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(campaign.totalSpend)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(campaign.totalImpressions)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clicks (CTR)</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(campaign.totalClicks)}
            </div>
            <p className="text-xs text-muted-foreground">CTR: {ctr}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversions (CPC)</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(campaign.totalConversions)}
            </div>
            <p className="text-xs text-muted-foreground">CPC: {cpc}</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
          <CardDescription>Daily spend, impressions, and clicks</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No metrics data available yet. Metrics are fetched daily.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  stroke="#8884d8"
                  name="Spend ($)"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  stroke="#82ca9d"
                  name="Impressions"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="clicks"
                  stroke="#ffc658"
                  name="Clicks"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ad Sets */}
      <Card>
        <CardHeader>
          <CardTitle>Ad Sets ({campaign.adSets?.length || 0})</CardTitle>
          <CardDescription>Ad set breakdown for this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {!campaign.adSets || campaign.adSets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No ad sets found. Create an ad set or sync from Meta.
            </p>
          ) : (
            <div className="space-y-4">
              {campaign.adSets.map((adSet: any) => (
                <div key={adSet.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium">{adSet.name}</h4>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[adSet.status]}`}
                      >
                        {adSet.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {adSet.dailyBudget
                        ? `${formatCurrency(adSet.dailyBudget)}/day`
                        : adSet.lifetimeBudget
                        ? `${formatCurrency(adSet.lifetimeBudget)} lifetime`
                        : '—'}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Spend:</span>{' '}
                      <span className="font-medium">{formatCurrency(adSet.totalSpend)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impressions:</span>{' '}
                      <span className="font-medium">{formatNumber(adSet.totalImpressions)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Clicks:</span>{' '}
                      <span className="font-medium">{formatNumber(adSet.totalClicks)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Conversions:</span>{' '}
                      <span className="font-medium">{formatNumber(adSet.totalConversions)}</span>
                    </div>
                  </div>

                  {/* Ads within ad set */}
                  {adSet.ads && adSet.ads.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 space-y-2">
                      {adSet.ads.map((ad: any) => (
                        <div key={ad.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{ad.name}</span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${statusColors[ad.status]}`}
                            >
                              {ad.status}
                            </span>
                            {ad.post && (
                              <span className="text-muted-foreground text-xs">
                                (Boosted post)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-muted-foreground">
                            <span>{formatCurrency(ad.totalSpend)}</span>
                            <span>{formatNumber(ad.totalImpressions)} imp.</span>
                            <span>{formatNumber(ad.totalClicks)} clicks</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Boosted Post */}
      {campaign.post && (
        <Card>
          <CardHeader>
            <CardTitle>Boosted Post</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{campaign.post.contentText}</p>
            {campaign.post.platformPostUrl && (
              <a
                href={campaign.post.platformPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline mt-2 inline-block"
              >
                View original post →
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
