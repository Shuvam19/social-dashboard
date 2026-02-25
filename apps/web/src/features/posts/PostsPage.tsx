import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import {
  FileText,
  Plus,
  Send,
  Trash2,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Megaphone,
} from 'lucide-react';
import { BoostPostDialog } from '@/features/campaigns/BoostPostDialog';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PUBLISHING: 'bg-yellow-100 text-yellow-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, any> = {
  DRAFT: Edit,
  SCHEDULED: Clock,
  PUBLISHING: Loader2,
  PUBLISHED: CheckCircle,
  FAILED: XCircle,
};

export function PostsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [boostPost, setBoostPost] = useState<{ id: string; content: string } | null>(null);

  const postsQuery = useQuery({
    queryKey: ['posts'],
    queryFn: () => postsApi.getAll(),
  });

  const publishMutation = useMutation({
    mutationFn: postsApi.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: 'Post published!',
        description: 'Your post has been published successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to publish',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: postsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: 'Post deleted',
        description: 'The post has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to delete',
        description: error.message,
      });
    },
  });

  const posts = postsQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-muted-foreground">
            Manage your social media content
          </p>
        </div>
        <Button asChild>
          <Link to="/posts/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Link>
        </Button>
      </div>

      {postsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No posts yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Create your first post to start publishing to your social media
                accounts.
              </p>
              <Button asChild className="mt-6">
                <Link to="/posts/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Post
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => {
            const StatusIcon = statusIcons[post.status] || Edit;
            return (
              <Card key={post.id}>
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar>
                      <AvatarImage src={post.socialAccount?.avatarUrl} />
                      <AvatarFallback>
                        {post.socialAccount?.displayName?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium">
                          {post.socialAccount?.displayName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {post.socialAccount?.platform}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[post.status]}`}
                        >
                          <StatusIcon
                            className={`h-3 w-3 mr-1 ${post.status === 'PUBLISHING' ? 'animate-spin' : ''}`}
                          />
                          {post.status}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {post.contentText}
                      </p>
                      {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className="mt-2 flex space-x-2">
                          {post.mediaUrls.map((url: string, i: number) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="h-20 w-20 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>
                          Created {new Date(post.createdAt).toLocaleString()}
                        </span>
                        {post.scheduledAt && (
                          <span>
                            Scheduled for{' '}
                            {new Date(post.scheduledAt).toLocaleString()}
                          </span>
                        )}
                        {post.publishedAt && (
                          <span>
                            Published {new Date(post.publishedAt).toLocaleString()}
                          </span>
                        )}
                        {post.platformPostUrl && (
                          <a
                            href={post.platformPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View on {post.socialAccount?.platform}
                          </a>
                        )}
                      </div>
                      {post.errorMessage && (
                        <p className="mt-2 text-sm text-red-600">
                          Error: {post.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {post.status === 'PUBLISHED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Boost Post"
                          onClick={() =>
                            setBoostPost({
                              id: post.id,
                              content: post.contentText,
                            })
                          }
                        >
                          <Megaphone className="h-4 w-4" />
                        </Button>
                      )}
                      {(post.status === 'DRAFT' || post.status === 'SCHEDULED') && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => publishMutation.mutate(post.id)}
                            disabled={publishMutation.isPending}
                          >
                            {publishMutation.isPending &&
                            publishMutation.variables === post.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(post.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Boost Post Dialog */}
      <BoostPostDialog
        postId={boostPost?.id || ''}
        postContent={boostPost?.content || ''}
        isOpen={!!boostPost}
        onClose={() => setBoostPost(null)}
      />
    </div>
  );
}
