import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { socialAccountsApi, postsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  Loader2,
  Save,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const platformColors: Record<string, string> = {
  FACEBOOK: 'border-[#1877F2]',
  INSTAGRAM: 'border-[#E1306C]',
  LINKEDIN: 'border-[#0A66C2]',
  TWITTER: 'border-black',
  TIKTOK: 'border-black',
  PINTEREST: 'border-[#E60023]',
};

const charLimits: Record<string, number> = {
  FACEBOOK: 63206,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
  TWITTER: 280,
  TIKTOK: 2200,
  PINTEREST: 500,
};

const createPostSchema = z.object({
  contentText: z.string().min(1, 'Content is required'),
  scheduledAt: z.string().optional(),
});

type CreatePostFormData = z.infer<typeof createPostSchema>;

export function CreatePostPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
  });

  const contentText = watch('contentText', '');

  const createMutation = useMutation({
    mutationFn: postsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: 'Post created!',
        description: 'Your post has been saved.',
      });
      navigate('/posts');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create post',
        description: error.message,
      });
    },
  });

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const onSubmit = (data: CreatePostFormData) => {
    if (selectedAccounts.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No accounts selected',
        description: 'Please select at least one account to post to.',
      });
      return;
    }

    createMutation.mutate({
      socialAccountIds: selectedAccounts,
      contentText: data.contentText,
      scheduledAt: data.scheduledAt || undefined,
    });
  };

  const accounts = accountsQuery.data || [];

  // Get character limit based on selected accounts
  const getCharacterLimit = () => {
    if (selectedAccounts.length === 0) return Infinity;
    const selectedPlatforms = accounts
      .filter((a: any) => selectedAccounts.includes(a.id))
      .map((a: any) => a.platform);
    return Math.min(...selectedPlatforms.map((p: string) => charLimits[p] || Infinity));
  };

  const characterLimit = getCharacterLimit();
  const remainingChars = characterLimit - contentText.length;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/posts">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Post</h1>
          <p className="text-muted-foreground">
            Compose and publish to your accounts
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Account Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Accounts</CardTitle>
            <CardDescription>
              Choose which accounts to post to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No accounts connected</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link to="/accounts/connect">Connect Account</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {accounts.map((account: any) => {
                  const isSelected = selectedAccounts.includes(account.id);
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      className={cn(
                        'flex items-center space-x-3 p-3 border-2 rounded-lg text-left transition-colors',
                        isSelected
                          ? `${platformColors[account.platform]} bg-gray-50`
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <Avatar>
                        <AvatarImage src={account.avatarUrl} />
                        <AvatarFallback>
                          {account.displayName?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {account.displayName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {account.platform}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>
              Write your post content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contentText">Post Text</Label>
              <textarea
                id="contentText"
                {...register('contentText')}
                rows={6}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
                  isOverLimit && 'border-red-500 focus-visible:ring-red-500'
                )}
                placeholder="What's on your mind?"
              />
              {errors.contentText && (
                <p className="text-sm text-destructive">
                  {errors.contentText.message}
                </p>
              )}
              <div className="flex justify-end">
                <span
                  className={cn(
                    'text-sm',
                    isOverLimit ? 'text-red-500' : 'text-muted-foreground'
                  )}
                >
                  {contentText.length}
                  {characterLimit < Infinity && ` / ${characterLimit}`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Schedule (optional)</Label>
              <input
                id="scheduledAt"
                type="datetime-local"
                {...register('scheduledAt')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/posts')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              createMutation.isPending ||
              selectedAccounts.length === 0 ||
              isOverLimit
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Post
          </Button>
        </div>
      </form>
    </div>
  );
}
