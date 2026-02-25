import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { socialAccountsApi, postsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  Loader2,
  Check,
  Smile,
  AtSign,
  Hash,
  Link2,
  MapPin,
  Image,
  Video,
  Upload,
  X,
  Play,
  Info,
  Sparkles,
  Send,
  FileText,
  Globe,
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Plus,
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

const platformBg: Record<string, string> = {
  FACEBOOK: 'bg-blue-50',
  INSTAGRAM: 'bg-pink-50',
  LINKEDIN: 'bg-sky-50',
  TWITTER: 'bg-slate-50',
  TIKTOK: 'bg-slate-50',
  PINTEREST: 'bg-red-50',
};

const platformAvatarBg: Record<string, string> = {
  FACEBOOK: 'bg-[#1877F2]',
  INSTAGRAM: 'bg-gradient-to-br from-[#E1306C] to-[#833AB4]',
  LINKEDIN: 'bg-[#0A66C2]',
  TWITTER: 'bg-black',
  TIKTOK: 'bg-black',
  PINTEREST: 'bg-[#E60023]',
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

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  altText: string;
}

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  domain: string;
  image?: string;
}

function Toggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        checked ? 'bg-primary' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export function CreatePostPage() {
  const navigate = useNavigate();
  const { id: postId } = useParams<{ id: string }>();
  const isEditMode = !!postId;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [firstComment, setFirstComment] = useState('');
  const [firstCommentEnabled, setFirstCommentEnabled] = useState(false);
  const [createAsThread, setCreateAsThread] = useState(false);
  const [postAsReel, setPostAsReel] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ['social-accounts'],
    queryFn: socialAccountsApi.getAll,
  });

  // Fetch existing post when in edit mode
  const postQuery = useQuery({
    queryKey: ['posts', postId],
    queryFn: () => postsApi.getById(postId!),
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
  });

  const contentText = watch('contentText', '');

  const createMutation = useMutation({
    mutationFn: postsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: 'Post created!', description: 'Your post has been saved.' });
      navigate('/posts');
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to create post', description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { contentText?: string; mediaUrls?: string[]; scheduledAt?: string; status?: string }) =>
      postsApi.update(postId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', postId] });
      toast({ title: 'Post updated!', description: 'Your changes have been saved.' });
      navigate('/posts');
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update post', description: error.message });
    },
  });

  // Populate form with existing post data when in edit mode
  useEffect(() => {
    if (postQuery.data) {
      const post = postQuery.data;
      setValue('contentText', post.contentText || '');
      if (post.scheduledAt) {
        const date = new Date(post.scheduledAt);
        const localDatetime = date.toISOString().slice(0, 16);
        setValue('scheduledAt', localDatetime);
      }
      if (post.socialAccountId) {
        setSelectedAccounts([post.socialAccountId]);
      }
    }
  }, [postQuery.data, setValue]);

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const onSubmit = (data: CreatePostFormData) => {
    if (!isEditMode && selectedAccounts.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No accounts selected',
        description: 'Please select at least one account to post to.',
      });
      return;
    }

    if (isEditMode) {
      updateMutation.mutate({
        contentText: data.contentText,
        scheduledAt: data.scheduledAt || undefined,
      });
    } else {
      createMutation.mutate({
        socialAccountIds: selectedAccounts,
        contentText: data.contentText,
        scheduledAt: data.scheduledAt || undefined,
      });
    }
  };

  const handleSaveDraft = () => {
    const contentText = watch('contentText');

    if (!contentText) {
      toast({
        variant: 'destructive',
        title: 'Content required',
        description: 'Please add some content before saving.'
      });
      return;
    }

    if (isEditMode) {
      // Update existing post as draft
      updateMutation.mutate({
        contentText,
        status: 'DRAFT',
      });
    } else {
      // Create new post as draft
      if (selectedAccounts.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No accounts selected',
          description: 'Please select at least one account to save draft.',
        });
        return;
      }
      createMutation.mutate({
        socialAccountIds: selectedAccounts,
        contentText,
        // No scheduledAt means it will be saved as DRAFT
      });
    }
  };

  // ── Media helpers ──────────────────────────────────────────────────────────

  const addMediaFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaFiles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            preview: reader.result as string,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            altText: '',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeMedia = (id: string) => setMediaFiles((prev) => prev.filter((m) => m.id !== id));

  const updateAltText = (id: string, text: string) => {
    setMediaFiles((prev) => prev.map((m) => (m.id === id ? { ...m, altText: text } : m)));
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addMediaFiles(e.dataTransfer.files);
  };

  // ── Link preview ───────────────────────────────────────────────────────────

  const fetchLinkPreview = async () => {
    if (!linkUrl) return;
    setIsFetchingLink(true);
    // Simulate a fetch — swap in a real OG-metadata API in production
    await new Promise((r) => setTimeout(r, 800));
    try {
      const domain = new URL(linkUrl).hostname.replace('www.', '');
      setLinkPreview({
        url: linkUrl,
        title: `Page from ${domain}`,
        description: 'Preview description would appear here once the URL metadata is fetched.',
        domain,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid URL.' });
    } finally {
      setIsFetchingLink(false);
    }
  };

  // ── Toolbar helpers ────────────────────────────────────────────────────────

  const insertText = (text: string) => {
    const current = contentText || '';
    setValue('contentText', current + text, { shouldValidate: true });
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const accounts = accountsQuery.data || [];
  const selectedPlatforms = accounts
    .filter((a: any) => selectedAccounts.includes(a.id))
    .map((a: any) => a.platform as string);
  const charLimit = selectedPlatforms.length
    ? Math.min(...selectedPlatforms.map((p) => charLimits[p] ?? Infinity))
    : null;
  const remainingChars = charLimit !== null ? charLimit - (contentText?.length ?? 0) : null;
  const isOverLimit = remainingChars !== null && remainingChars < 0;

  const suggestedHashtags = ['#NewPost', '#SocialMedia', '#Marketing', '#ContentCreation', '#Brand'];

  const previewPlatform =
    selectedPlatforms.includes('FACEBOOK') ? 'FACEBOOK'
      : selectedPlatforms.includes('INSTAGRAM') ? 'INSTAGRAM'
        : selectedPlatforms.includes('TWITTER') ? 'TWITTER'
          : selectedPlatforms.includes('LINKEDIN') ? 'LINKEDIN'
            : null;

  const previewAccount = accounts.find(
    (a: any) => selectedAccounts.includes(a.id) && a.platform === previewPlatform
  ) as any;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Loading state for edit mode */}
      {isEditMode && postQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state for edit mode */}
      {isEditMode && postQuery.isError && (
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load post. Please try again.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/posts')}>
            Go Back to Posts
          </Button>
        </div>
      )}

      {/* Only show form when not loading in edit mode */}
      {(!isEditMode || (isEditMode && postQuery.data)) && (
        <>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/posts"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditMode ? 'Edit Post' : 'Create Post'}</h1>
          <p className="text-muted-foreground text-sm">
            {isEditMode ? 'Make changes to your post' : 'Compose and publish to your social media accounts'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">

          {/* ══════════════════════════════════════════════════════════════════
              LEFT COLUMN
          ══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Select Accounts ─────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {isEditMode ? 'Account' : 'Select Accounts'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {isEditMode ? 'This post is associated with this account' : 'Choose which platforms to post to'}
                    </CardDescription>
                  </div>
                  {!isEditMode && selectedAccounts.length > 0 && (
                    <Badge variant="secondary">{selectedAccounts.length} selected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditMode && postQuery.data ? (
                  // Show the associated account for edit mode
                  <div className="flex items-center gap-3 p-3 border-2 rounded-lg bg-muted/30">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={postQuery.data.socialAccount?.avatarUrl} />
                      <AvatarFallback className={cn('text-white text-sm font-semibold', platformAvatarBg[postQuery.data.socialAccount?.platform])}>
                        {postQuery.data.socialAccount?.displayName?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{postQuery.data.socialAccount?.displayName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{postQuery.data.socialAccount?.platform?.toLowerCase()}</p>
                    </div>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-muted-foreground text-sm">No accounts connected</p>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/accounts/connect">Connect Account</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((account: any) => {
                      const isSelected = selectedAccounts.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => toggleAccount(account.id)}
                          className={cn(
                            'flex items-center gap-3 p-3 border-2 rounded-lg text-left transition-all',
                            isSelected
                              ? `${platformColors[account.platform]} ${platformBg[account.platform]}`
                              : 'border-border hover:border-muted-foreground/40'
                          )}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={account.avatarUrl} />
                            <AvatarFallback className={cn('text-white text-sm font-semibold', platformAvatarBg[account.platform])}>
                              {account.displayName?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{account.displayName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{account.platform.toLowerCase()}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Content / Composer ──────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Content</CardTitle>
                    <CardDescription className="text-xs">Write your post copy</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-sky-600 border-sky-200 bg-sky-50 hover:bg-sky-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Assist
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-0 p-0">
                <div className="px-6 pb-2">
                  <Textarea
                    id="contentText"
                    {...register('contentText')}
                    rows={6}
                    placeholder="What's on your mind? Share news, updates, or engage your audience..."
                    className={cn(
                      'resize-none border-0 shadow-none focus-visible:ring-0 px-0 text-sm',
                      isOverLimit && 'text-destructive'
                    )}
                  />
                  {errors.contentText && (
                    <p className="text-xs text-destructive mt-1">{errors.contentText.message}</p>
                  )}
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-0.5 px-4 py-2 border-t bg-muted/40">
                  {[
                    { icon: Smile, label: 'Emoji', action: () => insertText(' 😊') },
                    { icon: AtSign, label: 'Mention', action: () => insertText(' @') },
                    { icon: Hash, label: 'Hashtag', action: () => insertText(' #') },
                    { icon: Link2, label: 'Link', action: () => { } },
                    { icon: MapPin, label: 'Location', action: () => { } },
                  ].map(({ icon: Icon, label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      title={label}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                  <div className="w-px h-4 bg-border mx-1" />
                  <div className="flex-1" />
                  <span className={cn('text-xs', isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                    {contentText?.length ?? 0}{charLimit !== null && ` / ${charLimit}`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ── Media Upload ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Media</CardTitle>
                <CardDescription className="text-xs">Add images or video to your post</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                  )}
                >
                  <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Drag & drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, MP4 · up to 100 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addMediaFiles(e.target.files)}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files && addMediaFiles(e.target.files)}
                />

                {/* Quick add buttons */}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <Image className="h-4 w-4" /> Add Image
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => videoInputRef.current?.click()}>
                    <Video className="h-4 w-4" /> Add Video
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <span className="text-xs font-semibold">GIF</span>
                  </Button>
                </div>

                {/* Uploaded media thumbnails */}
                {mediaFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      {mediaFiles.map((media) => (
                        <div key={media.id} className="relative group">
                          <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted border">
                            {media.type === 'image' ? (
                              <img src={media.preview} alt={media.altText || 'Upload'} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white">
                                <Play className="h-6 w-6" />
                                <span className="text-[10px] mt-1">Video</span>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedia(media.id)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-muted-foreground/50 transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-[10px] mt-1">Add more</span>
                      </button>
                    </div>

                    {/* Alt text inputs */}
                    {mediaFiles.filter((m) => m.type === 'image').length > 0 && (
                      <div className="space-y-2">
                        {mediaFiles.filter((m) => m.type === 'image').map((media, i) => (
                          <div key={media.id} className="flex items-center gap-2">
                            <img src={media.preview} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                            <Input
                              placeholder={`Alt text for image ${i + 1}...`}
                              value={media.altText}
                              onChange={(e) => updateAltText(media.id, e.target.value)}
                              className="text-xs h-8"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Alt text tip */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Add alt text to images for accessibility. This also improves reach on LinkedIn and Instagram.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Link Preview ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Link Preview</CardTitle>
                <CardDescription className="text-xs">Auto-generates a rich preview from a URL</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), fetchLinkPreview())}
                      placeholder="https://example.com/your-link"
                      className="pl-9 text-sm"
                    />
                  </div>
                  <Button type="button" onClick={fetchLinkPreview} disabled={isFetchingLink || !linkUrl} size="sm">
                    {isFetchingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                  </Button>
                  {linkPreview && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setLinkPreview(null); setLinkUrl(''); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {linkPreview && (
                  <div className="flex gap-3 border rounded-lg overflow-hidden bg-muted/30">
                    <div className="w-20 h-20 bg-muted shrink-0 flex items-center justify-center">
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="py-3 pr-3 space-y-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{linkPreview.domain}</p>
                      <p className="text-sm font-semibold line-clamp-2 leading-tight">{linkPreview.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{linkPreview.description}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Schedule + Actions ───────────────────────────────────────── */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="scheduledAt" className="text-sm">
                      Schedule{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <input
                      id="scheduledAt"
                      type="datetime-local"
                      {...register('scheduledAt')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" variant="outline" onClick={() => navigate('/posts')}>
                      Cancel
                    </Button>
                    <Button type="button" variant="outline" className="gap-1.5" onClick={handleSaveDraft} disabled={createMutation.isPending || updateMutation.isPending}>
                      {(createMutation.isPending || updateMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Save Draft
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending || (!isEditMode && selectedAccounts.length === 0) || isOverLimit}
                      className="gap-1.5"
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isEditMode ? 'Update Post' : 'Publish Now'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT COLUMN
          ══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Post Preview ────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between mb-3">
                  <CardTitle className="text-sm font-semibold">Post Preview</CardTitle>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live preview
                  </span>
                </div>
                <Tabs defaultValue="facebook">
                  <TabsList className="w-full h-9">
                    <TabsTrigger value="facebook" className="flex-1 text-xs">Facebook</TabsTrigger>
                    <TabsTrigger value="twitter" className="flex-1 text-xs">Twitter</TabsTrigger>
                    <TabsTrigger value="linkedin" className="flex-1 text-xs">LinkedIn</TabsTrigger>
                  </TabsList>

                  {/* Facebook preview */}
                  <TabsContent value="facebook" className="mt-0">
                    <div className="pt-4 space-y-3">
                      {/* Post header */}
                      <div className="flex items-start gap-2">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={previewAccount?.avatarUrl} />
                          <AvatarFallback className="bg-[#1877F2] text-white text-sm font-bold">
                            {previewAccount?.displayName?.charAt(0) ?? 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{previewAccount?.displayName ?? 'Your Page'}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Just now ·</span>
                            <Globe className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Post body */}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {contentText || (
                          <span className="text-muted-foreground italic">Your post will appear here...</span>
                        )}
                      </p>

                      {/* Media preview */}
                      {mediaFiles.length > 0 && (
                        <div className={cn(
                          'rounded-lg overflow-hidden',
                          mediaFiles.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'
                        )}>
                          {mediaFiles.slice(0, 4).map((m, i) => (
                            <div key={m.id} className={cn('bg-muted', mediaFiles.length === 1 ? 'aspect-video' : 'aspect-square')}>
                              {m.type === 'image' ? (
                                <img src={m.preview} alt={m.altText} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                  <Play className="h-8 w-8 text-white" />
                                </div>
                              )}
                              {i === 3 && mediaFiles.length > 4 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <span className="text-white font-bold text-lg">+{mediaFiles.length - 4}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Link preview in post */}
                      {linkPreview && (
                        <div className="border rounded overflow-hidden">
                          <div className="h-12 bg-muted flex items-center justify-center">
                            <Globe className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="p-2.5 bg-muted/30">
                            <p className="text-[10px] text-muted-foreground uppercase">{linkPreview.domain}</p>
                            <p className="text-xs font-semibold">{linkPreview.title}</p>
                          </div>
                        </div>
                      )}

                      {/* Engagement bar */}
                      <div className="flex border-t pt-1 -mx-1">
                        {[
                          { icon: ThumbsUp, label: 'Like' },
                          { icon: MessageCircle, label: 'Comment' },
                          { icon: Share2, label: 'Share' },
                        ].map(({ icon: Icon, label }) => (
                          <button
                            key={label}
                            type="button"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground font-medium rounded-md hover:bg-muted transition-colors"
                          >
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Twitter preview */}
                  <TabsContent value="twitter" className="mt-0">
                    <div className="pt-4 space-y-2">
                      <div className="flex gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={previewAccount?.avatarUrl} />
                          <AvatarFallback className="bg-black text-white text-sm font-bold">
                            {previewAccount?.displayName?.charAt(0) ?? 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold">{previewAccount?.displayName ?? 'Your Account'}</span>
                            <span className="text-xs text-muted-foreground">· just now</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap mt-1">
                            {contentText || <span className="text-muted-foreground italic">Your tweet...</span>}
                          </p>
                          {charLimit && contentText && (
                            <p className={cn('text-xs mt-1', isOverLimit ? 'text-destructive' : 'text-muted-foreground')}>
                              {charLimit - contentText.length} chars remaining
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* LinkedIn preview */}
                  <TabsContent value="linkedin" className="mt-0">
                    <div className="pt-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={previewAccount?.avatarUrl} />
                          <AvatarFallback className="bg-[#0A66C2] text-white text-sm font-bold">
                            {previewAccount?.displayName?.charAt(0) ?? 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{previewAccount?.displayName ?? 'Your Profile'}</p>
                          <p className="text-xs text-muted-foreground">Just now · 🌐</p>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {contentText || <span className="text-muted-foreground italic">Your LinkedIn post...</span>}
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>

            {/* ── Platform Settings ────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Platform Settings</CardTitle>
                <CardDescription className="text-xs">Customize per-platform options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">

                {/* LinkedIn: First Comment */}
                <div className="rounded-lg bg-muted/40 border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center shrink-0">
                        <span className="text-white text-[9px] font-bold leading-none">in</span>
                      </div>
                      <span className="text-xs font-medium">First Comment (LinkedIn)</span>
                    </div>
                    <Toggle checked={firstCommentEnabled} onToggle={() => setFirstCommentEnabled((v) => !v)} />
                  </div>
                  {firstCommentEnabled && (
                    <Textarea
                      value={firstComment}
                      onChange={(e) => setFirstComment(e.target.value)}
                      placeholder="Add a first comment to boost reach — great for hashtags..."
                      rows={2}
                      className="text-xs resize-none"
                    />
                  )}
                </div>

                {/* Twitter: Thread */}
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 border p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-black flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold leading-none">X</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Create as Thread</p>
                      <p className="text-[10px] text-muted-foreground">Split into multiple tweets</p>
                    </div>
                  </div>
                  <Toggle checked={createAsThread} onToggle={() => setCreateAsThread((v) => !v)} />
                </div>

                {/* Instagram: Reel */}
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 border p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-gradient-to-br from-[#E1306C] to-[#833AB4] flex items-center justify-center shrink-0">
                      <span className="text-white text-[8px] font-bold leading-none">IG</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Post as Reel</p>
                      <p className="text-[10px] text-muted-foreground">Format video as Instagram Reel</p>
                    </div>
                  </div>
                  <Toggle checked={postAsReel} onToggle={() => setPostAsReel((v) => !v)} />
                </div>

                {/* Suggested Hashtags */}
                <div className="space-y-2">
                  <p className="text-xs font-medium">Suggested Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedHashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertText(` ${tag}`)}
                        className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
        </>
      )}
    </div>
  );
}
