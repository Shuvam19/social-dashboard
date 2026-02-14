import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { socialAccountsApi, postsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Share2,
  FileText,
  Users,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';

const platformColors: Record<string, string> = {
  FACEBOOK: 'bg-[#1877F2]',
  INSTAGRAM: 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]',
  LINKEDIN: 'bg-[#0A66C2]',
  TWITTER: 'bg-black',
  TIKTOK: 'bg-black',
  PINTEREST: 'bg-[#E60023]',
};

export function DashboardPage() {
  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
  });

  const postsQuery = useQuery({
    queryKey: ['posts'],
    queryFn: () => postsApi.getAll(),
  });

  const accounts = accountsQuery.data || [];
  const posts = postsQuery.data || [];

  const publishedPosts = posts.filter((p: any) => p.status === 'PUBLISHED').length;
  const scheduledPosts = posts.filter((p: any) => p.status === 'SCHEDULED').length;
  const draftPosts = posts.filter((p: any) => p.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your social media presence
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Connected Accounts
            </CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">
              Across {new Set(accounts.map((a: any) => a.platform)).size} platforms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedPosts}</div>
            <p className="text-xs text-muted-foreground">
              {scheduledPosts} scheduled, {draftPosts} drafts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Coming in Phase 2
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inbox</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Coming in Phase 2
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connected accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              Your linked social media profiles
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to="/accounts/connect">
              <Plus className="h-4 w-4 mr-2" />
              Connect
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Share2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No accounts connected</h3>
              <p className="text-muted-foreground">
                Connect your social media accounts to get started
              </p>
              <Button asChild className="mt-4">
                <Link to="/accounts/connect">Connect Account</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account: any) => (
                <div
                  key={account.id}
                  className="flex items-center space-x-4 p-4 border rounded-lg"
                >
                  <Avatar>
                    <AvatarImage src={account.avatarUrl} />
                    <AvatarFallback
                      className={`text-white ${platformColors[account.platform] || 'bg-gray-500'}`}
                    >
                      {account.displayName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{account.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.platform}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent posts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>Your latest content</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/posts">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No posts yet</h3>
              <p className="text-muted-foreground">
                Create your first post to get started
              </p>
              <Button asChild className="mt-4">
                <Link to="/posts/create">Create Post</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.slice(0, 5).map((post: any) => (
                <div
                  key={post.id}
                  className="flex items-start space-x-4 p-4 border rounded-lg"
                >
                  <Avatar className="mt-1">
                    <AvatarImage src={post.socialAccount?.avatarUrl} />
                    <AvatarFallback>
                      {post.socialAccount?.displayName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">
                        {post.socialAccount?.displayName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                        {post.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {post.contentText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
