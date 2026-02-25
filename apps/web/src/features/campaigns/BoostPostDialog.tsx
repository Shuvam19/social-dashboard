import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adsApi, socialAccountsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, X } from 'lucide-react';

interface BoostPostDialogProps {
  postId: string;
  postContent: string;
  isOpen: boolean;
  onClose: () => void;
}

const objectives = [
  { value: 'AWARENESS', label: 'Awareness' },
  { value: 'TRAFFIC', label: 'Traffic' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
];

export function BoostPostDialog({
  postId,
  postContent,
  isOpen,
  onClose,
}: BoostPostDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    socialAccountId: '',
    budgetAmount: '2000',
    budgetType: 'DAILY',
    duration: '7',
    objective: 'AWARENESS',
    name: '',
  });

  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
    enabled: isOpen,
  });

  const boostMutation = useMutation({
    mutationFn: (data: any) => adsApi.boostPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({
        title: 'Post boosted!',
        description: 'Your boosted post campaign has been created.',
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to boost post',
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

    boostMutation.mutate({
      postId,
      socialAccountId: form.socialAccountId,
      name: form.name || undefined,
      budgetAmount: parseInt(form.budgetAmount),
      budgetType: form.budgetType,
      duration: parseInt(form.duration),
      objective: form.objective,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Boost Post</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Post preview */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {postContent}
            </p>
          </div>

          {/* Account */}
          <div>
            <Label>Ad Account</Label>
            {metaAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No Meta accounts available
              </p>
            ) : (
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white mt-1"
                value={form.socialAccountId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, socialAccountId: e.target.value }))
                }
              >
                <option value="">Select account...</option>
                {metaAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} ({a.platform})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Objective */}
          <div>
            <Label>Objective</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white mt-1"
              value={form.objective}
              onChange={(e) =>
                setForm((f) => ({ ...f, objective: e.target.value }))
              }
            >
              {objectives.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Budget */}
          <div className="flex space-x-3">
            <div className="flex-1">
              <Label>Budget (cents)</Label>
              <Input
                type="number"
                min="100"
                placeholder="2000 = $20"
                value={form.budgetAmount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budgetAmount: e.target.value }))
                }
              />
              {form.budgetAmount && (
                <p className="text-xs text-muted-foreground mt-1">
                  = ${(parseInt(form.budgetAmount) / 100).toFixed(2)}
                </p>
              )}
            </div>
            <div className="flex-1">
              <Label>Type</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white mt-1"
                value={form.budgetType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budgetType: e.target.value }))
                }
              >
                <option value="DAILY">Daily</option>
                <option value="LIFETIME">Lifetime</option>
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min="1"
              max="90"
              value={form.duration}
              onChange={(e) =>
                setForm((f) => ({ ...f, duration: e.target.value }))
              }
            />
          </div>

          {/* Custom name */}
          <div>
            <Label>Campaign Name (optional)</Label>
            <Input
              placeholder="Auto-generated if empty"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={boostMutation.isPending}>
              {boostMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Boost Post
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
