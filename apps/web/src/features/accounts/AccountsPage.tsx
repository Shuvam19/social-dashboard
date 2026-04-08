import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { socialAccountsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import {
  Share2,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';

const platformColors: Record<string, string> = {
  FACEBOOK: 'bg-[#1877F2]',
  INSTAGRAM: 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]',
  LINKEDIN: 'bg-[#0A66C2]',
  TWITTER: 'bg-black',
  TIKTOK: 'bg-black',
  PINTEREST: 'bg-[#E60023]',
  YOUTUBE: 'bg-[#FF0000]',
};

const platformNames: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  TWITTER: 'X (Twitter)',
  TIKTOK: 'TikTok',
  PINTEREST: 'Pinterest',
  YOUTUBE: 'YouTube',
};

export function AccountsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
  });

  const disconnectMutation = useMutation({
    mutationFn: socialAccountsApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      toast({
        title: 'Account disconnected',
        description: 'The social account has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to disconnect',
        description: error.message,
      });
    },
  });

  const accounts = accountsQuery.data || [];

  // Group accounts by platform
  const accountsByPlatform = accounts.reduce((acc: any, account: any) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
          <p className="text-muted-foreground">
            Manage your social media connections
          </p>
        </div>
        <Button asChild>
          <Link to="/accounts/connect">
            <Plus className="h-4 w-4 mr-2" />
            Connect Account
          </Link>
        </Button>
      </div>

      {accountsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Share2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No accounts connected</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Connect your social media accounts to start managing your content
                from one place.
              </p>
              <Button asChild className="mt-6">
                <Link to="/accounts/connect">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Your First Account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(accountsByPlatform).map(([platform, platformAccounts]: [string, any]) => (
            <Card key={platform}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${platformColors[platform] || 'bg-gray-500'}`}
                  >
                    <Share2 className="h-4 w-4" />
                  </div>
                  <span>{platformNames[platform] || platform}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({platformAccounts.length} account{platformAccounts.length > 1 ? 's' : ''})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {platformAccounts.map((account: any) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={account.avatarUrl} />
                          <AvatarFallback
                            className={`text-white ${platformColors[platform] || 'bg-gray-500'}`}
                          >
                            {account.displayName?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{account.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            @{account.platformUsername}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Connected {new Date(account.connectedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectMutation.mutate(account.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
