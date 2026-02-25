import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adsApi, socialAccountsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const objectives = [
  { value: 'TRAFFIC', label: 'Traffic', description: 'Drive traffic to your website' },
  { value: 'AWARENESS', label: 'Awareness', description: 'Reach people likely to remember your ad' },
  { value: 'ENGAGEMENT', label: 'Engagement', description: 'Get more likes, comments, and shares' },
  { value: 'LEADS', label: 'Leads', description: 'Collect leads for your business' },
  { value: 'SALES', label: 'Sales', description: 'Drive online sales and conversions' },
];

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    socialAccountId: '',
    name: '',
    objective: 'TRAFFIC',
    budgetType: 'DAILY',
    budgetAmount: '',
    currency: 'USD',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adsApi.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({
        title: 'Campaign created!',
        description: 'Your ad campaign has been created successfully.',
      });
      navigate('/campaigns');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create campaign',
        description: error.message,
      });
    },
  });

  const metaAccounts = (accountsQuery.data || []).filter(
    (a: any) => a.platform === 'FACEBOOK' || a.platform === 'INSTAGRAM',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.socialAccountId) {
      toast({ variant: 'destructive', title: 'Please select an account' });
      return;
    }
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Please enter a campaign name' });
      return;
    }
    if (!form.budgetAmount || parseInt(form.budgetAmount) < 100) {
      toast({
        variant: 'destructive',
        title: 'Budget must be at least $1.00 (100 cents)',
      });
      return;
    }

    createMutation.mutate({
      socialAccountId: form.socialAccountId,
      name: form.name,
      objective: form.objective,
      budgetType: form.budgetType,
      budgetAmount: parseInt(form.budgetAmount),
      currency: form.currency,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/campaigns">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Create Campaign</h1>
        <p className="text-muted-foreground">
          Set up a new ad campaign on Meta (Facebook/Instagram)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ad Account</CardTitle>
            <CardDescription>Select the Meta account to run ads on</CardDescription>
          </CardHeader>
          <CardContent>
            {metaAccounts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-2">
                  No Meta accounts connected. Connect a Facebook or Instagram account first.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/accounts/connect">Connect Account</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {metaAccounts.map((account: any) => (
                  <label
                    key={account.id}
                    className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      form.socialAccountId === account.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="socialAccountId"
                      value={account.id}
                      checked={form.socialAccountId === account.id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, socialAccountId: e.target.value }))
                      }
                      className="text-primary"
                    />
                    <div>
                      <p className="font-medium">{account.displayName}</p>
                      <p className="text-sm text-muted-foreground">{account.platform}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                placeholder="e.g. Summer Sale 2026"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Objective</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {objectives.map((obj) => (
                  <label
                    key={obj.value}
                    className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      form.objective === obj.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="objective"
                      value={obj.value}
                      checked={form.objective === obj.value}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, objective: e.target.value }))
                      }
                      className="text-primary"
                    />
                    <div>
                      <p className="font-medium">{obj.label}</p>
                      <p className="text-xs text-muted-foreground">{obj.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Budget & Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Label>Budget Type</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white mt-1"
                  value={form.budgetType}
                  onChange={(e) => setForm((f) => ({ ...f, budgetType: e.target.value }))}
                >
                  <option value="DAILY">Daily Budget</option>
                  <option value="LIFETIME">Lifetime Budget</option>
                </select>
              </div>
              <div className="flex-1">
                <Label htmlFor="budget">Amount (in cents)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="5000 = $50.00"
                  min="100"
                  value={form.budgetAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, budgetAmount: e.target.value }))
                  }
                />
                {form.budgetAmount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    = ${(parseInt(form.budgetAmount) / 100).toFixed(2)} {form.currency}
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-4">
              <div className="flex-1">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={() => navigate('/campaigns')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Create Campaign
          </Button>
        </div>
      </form>
    </div>
  );
}
