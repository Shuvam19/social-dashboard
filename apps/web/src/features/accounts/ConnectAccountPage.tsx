import {useEffect} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {socialAccountsApi} from '@/lib/api';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {useToast} from '@/components/ui/use-toast';
import {ArrowLeft, CheckCircle, Facebook, Instagram, Linkedin, Loader2, Music, Twitter, XCircle,} from 'lucide-react';

const platforms = [
  {
    id: 'FACEBOOK',
    name: 'Facebook',
    description: 'Connect Facebook Pages',
    icon: Facebook,
    color: 'bg-[#1877F2] hover:bg-[#1877F2]/90',
    available: true,
  },
  {
    id: 'INSTAGRAM',
    name: 'Instagram',
    description: 'Connect Instagram Business accounts',
    icon: Instagram,
    color: 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-90',
    available: true,
  },
  {
    id: 'LINKEDIN',
    name: 'LinkedIn',
    description: 'Connect your LinkedIn profile',
    icon: Linkedin,
    color: 'bg-[#0A66C2] hover:bg-[#0A66C2]/90',
    available: true,
  },
  {
    id: 'TWITTER',
    name: 'X (Twitter)',
    description: 'Connect your X account',
    icon: Twitter,
    color: 'bg-black hover:bg-black/90',
    available: true,
  },
  {
    id: 'TIKTOK',
    name: 'TikTok',
    description: 'Connect your TikTok account',
    icon: Music,
    color: 'bg-black hover:bg-black/90',
    available: true,
  },
  {
    id: 'PINTEREST',
    name: 'Pinterest',
    description: 'Connect your Pinterest account',
    icon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
    ),
    color: 'bg-[#E60023] hover:bg-[#E60023]/90',
    available: true,
  },
];

export function ConnectAccountPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const success = searchParams.get('success');
  const error = searchParams.get('error');
  //const _accountId = searchParams.get('accountId');

  useEffect(() => {
    if (success === 'true') {
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      toast({
        title: 'Account connected!',
        description: 'Your social media account has been linked successfully.',
      });
    } else if (error) {
      toast({
        variant: 'destructive',
        title: 'Connection failed',
        description: decodeURIComponent(error),
      });
    }
  }, [success, error]);

  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      return await socialAccountsApi.getAuthUrl(platform);
    },
    onSuccess: (data) => {
      // Redirect to OAuth URL
      window.location.href = data.authorizationUrl;
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to connect',
        description: error.message,
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/accounts">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Connect Account</h1>
          <p className="text-muted-foreground">
            Link a new social media account
          </p>
        </div>
      </div>

      {/* Success/Error messages */}
      {success === 'true' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800">
                Account connected successfully!{' '}
                <Link to="/accounts" className="underline">
                  View all accounts
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center space-x-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{decodeURIComponent(error)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform selection */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <Card key={platform.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${platform.color.split(' ')[0]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span>{platform.name}</span>
                </CardTitle>
                <CardDescription>{platform.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className={`w-full text-white ${platform.color}`}
                  onClick={() => connectMutation.mutate(platform.id)}
                  disabled={!platform.available || connectMutation.isPending}
                >
                  {connectMutation.isPending &&
                  connectMutation.variables === platform.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {platform.available ? 'Connect' : 'Coming Soon'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Need help?</CardTitle>
          <CardDescription>
            Before connecting, make sure you have the following:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              <span>
                <strong>Facebook/Instagram:</strong> A Facebook Page or Instagram
                Business account
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              <span>
                <strong>LinkedIn:</strong> A personal or company LinkedIn profile
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              <span>
                <strong>X (Twitter):</strong> A Twitter/X account with API access
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              <span>
                <strong>TikTok:</strong> A TikTok Business or Creator account
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
