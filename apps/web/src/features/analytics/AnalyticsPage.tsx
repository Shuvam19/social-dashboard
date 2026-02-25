import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  TrendingUp,
  TrendingDown,
  Megaphone,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

type DateRange = '7d' | '14d' | '30d' | '90d';

function getDateRange(range: DateRange) {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '14d':
      from.setDate(from.getDate() - 14);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
  }
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = value > 0;
  return (
    <span
      className={`flex items-center text-xs font-medium ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3 mr-1" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-1" />
      )}
      {isPositive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { from, to } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', from, to],
    queryFn: () => analyticsApi.getOverview(from, to),
  });

  if (overviewQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overview = overviewQuery.data;
  const summary = overview?.summary || {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    ctr: 0,
    cpc: 0,
    activeCampaigns: 0,
    spendChange: 0,
    impressionsChange: 0,
    clicksChange: 0,
  };

  const dailyMetrics = (overview?.dailyMetrics || []).map((m: any) => ({
    ...m,
    spendDollars: m.spend / 100,
  }));

  const topCampaigns = overview?.topCampaigns || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Consolidated ad performance reporting
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {(['7d', '14d', '30d', '90d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
            >
              {range === '7d'
                ? '7 Days'
                : range === '14d'
                ? '14 Days'
                : range === '30d'
                ? '30 Days'
                : '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeCampaigns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalSpend)}</div>
            <ChangeIndicator value={summary.spendChange} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalImpressions)}</div>
            <ChangeIndicator value={summary.impressionsChange} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clicks (CTR)</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalClicks)}</div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">
                CTR: {summary.ctr.toFixed(2)}%
              </span>
              <ChangeIndicator value={summary.clicksChange} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversions (CPC)</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalConversions)}</div>
            <p className="text-xs text-muted-foreground">
              CPC: {formatCurrency(Math.round(summary.cpc))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spend & Impressions Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Spend & Impressions Over Time</CardTitle>
          <CardDescription>Daily ad performance trends</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyMetrics.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No data available for the selected period. Metrics are collected daily.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name?: string) => {
                    if (name === 'Spend') return [`$${Number(value).toFixed(2)}`, name];
                    return [formatNumber(value), name || ''];
                  }}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spendDollars"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.1}
                  name="Spend"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.1}
                  name="Impressions"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Clicks & Conversions Chart */}
      {dailyMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Clicks & Conversions</CardTitle>
            <CardDescription>Daily engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="clicks" fill="#ffc658" name="Clicks" />
                <Bar dataKey="conversions" fill="#ff7300" name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Campaigns Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Top Campaigns by Spend</CardTitle>
            <CardDescription>Best performing campaigns in the selected period</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/campaigns">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No campaign data available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Campaign</th>
                    <th className="text-left py-3 px-2 font-medium">Platform</th>
                    <th className="text-right py-3 px-2 font-medium">Spend</th>
                    <th className="text-right py-3 px-2 font-medium">Impressions</th>
                    <th className="text-right py-3 px-2 font-medium">Clicks</th>
                    <th className="text-right py-3 px-2 font-medium">CTR</th>
                    <th className="text-right py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((campaign: any) => {
                    const ctr =
                      campaign.totalImpressions > 0
                        ? ((campaign.totalClicks / campaign.totalImpressions) * 100).toFixed(2)
                        : '0';
                    return (
                      <tr key={campaign.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <Link
                            to={`/campaigns/${campaign.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {campaign.name}
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {campaign.socialAccount?.platform}
                        </td>
                        <td className="py-3 px-2 text-right font-medium">
                          {formatCurrency(campaign.totalSpend)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatNumber(campaign.totalImpressions)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatNumber(campaign.totalClicks)}
                        </td>
                        <td className="py-3 px-2 text-right">{ctr}%</td>
                        <td className="py-3 px-2 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              campaign.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : campaign.status === 'PAUSED'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
