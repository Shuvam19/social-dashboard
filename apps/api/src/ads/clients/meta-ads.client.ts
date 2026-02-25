import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MetaCampaignData {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
  updated_time: string;
}

export interface MetaAdSetData {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  bid_amount?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  created_time: string;
  updated_time: string;
}

export interface MetaAdData {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  creative?: {
    id: string;
    effective_object_story_id?: string;
    body?: string;
    title?: string;
    image_url?: string;
    call_to_action_type?: string;
  };
  created_time: string;
  updated_time: string;
}

export interface MetaInsightsData {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversions?: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
}

export interface MetaAdAccountData {
  id: string; // e.g., "act_1234567890"
  name: string;
  account_id: string;
  currency: string;
  account_status: number;
}

@Injectable()
export class MetaAdsClient {
  private readonly logger = new Logger(MetaAdsClient.name);
  private readonly graphUrl = 'https://graph.facebook.com/v18.0';

  constructor(private configService: ConfigService) {}

  // ============== Ad Account ==============

  async getAdAccounts(accessToken: string): Promise<MetaAdAccountData[]> {
    const response = await this.graphRequest(
      `/me/adaccounts?fields=id,name,account_id,currency,account_status&access_token=${accessToken}`,
    );
    return response.data || [];
  }

  // ============== Campaigns ==============

  async getCampaigns(
    adAccountId: string,
    accessToken: string,
  ): Promise<MetaCampaignData[]> {
    const response = await this.graphRequest(
      `/${adAccountId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time&access_token=${accessToken}`,
    );
    return response.data || [];
  }

  async createCampaign(
    adAccountId: string,
    accessToken: string,
    params: {
      name: string;
      objective: string;
      status?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      special_ad_categories?: string[];
    },
  ): Promise<{ id: string }> {
    const body: Record<string, any> = {
      ...params,
      access_token: accessToken,
      special_ad_categories: params.special_ad_categories || ['NONE'],
    };

    return this.graphRequest(`/${adAccountId}/campaigns`, {
      method: 'POST',
      body,
    });
  }

  async updateCampaignStatus(
    campaignId: string,
    accessToken: string,
    status: string,
  ): Promise<{ success: boolean }> {
    return this.graphRequest(`/${campaignId}`, {
      method: 'POST',
      body: { status, access_token: accessToken },
    });
  }

  // ============== Ad Sets ==============

  async getAdSets(
    campaignId: string,
    accessToken: string,
  ): Promise<MetaAdSetData[]> {
    const response = await this.graphRequest(
      `/${campaignId}/adsets?fields=id,name,campaign_id,status,daily_budget,lifetime_budget,bid_strategy,bid_amount,targeting,start_time,end_time,created_time,updated_time&access_token=${accessToken}`,
    );
    return response.data || [];
  }

  async createAdSet(
    adAccountId: string,
    accessToken: string,
    params: {
      name: string;
      campaign_id: string;
      daily_budget?: string;
      lifetime_budget?: string;
      bid_strategy?: string;
      bid_amount?: string;
      targeting: Record<string, unknown>;
      start_time?: string;
      end_time?: string;
      billing_event?: string;
      optimization_goal?: string;
      status?: string;
    },
  ): Promise<{ id: string }> {
    return this.graphRequest(`/${adAccountId}/adsets`, {
      method: 'POST',
      body: {
        ...params,
        billing_event: params.billing_event || 'IMPRESSIONS',
        optimization_goal: params.optimization_goal || 'REACH',
        access_token: accessToken,
      },
    });
  }

  // ============== Ads ==============

  async getAds(
    adSetId: string,
    accessToken: string,
  ): Promise<MetaAdData[]> {
    const response = await this.graphRequest(
      `/${adSetId}/ads?fields=id,name,adset_id,status,creative{id,effective_object_story_id,body,title,image_url,call_to_action_type},created_time,updated_time&access_token=${accessToken}`,
    );
    return response.data || [];
  }

  async createAdFromPost(
    adAccountId: string,
    accessToken: string,
    params: {
      name: string;
      adset_id: string;
      creative_object_story_id: string; // The organic post ID (page_id_post_id)
      status?: string;
    },
  ): Promise<{ id: string }> {
    // Step 1: Create ad creative from existing post
    const creative = await this.graphRequest(`/${adAccountId}/adcreatives`, {
      method: 'POST',
      body: {
        name: `${params.name} Creative`,
        object_story_id: params.creative_object_story_id,
        access_token: accessToken,
      },
    });

    // Step 2: Create the ad using the creative
    return this.graphRequest(`/${adAccountId}/ads`, {
      method: 'POST',
      body: {
        name: params.name,
        adset_id: params.adset_id,
        creative: { creative_id: creative.id },
        status: params.status || 'PAUSED',
        access_token: accessToken,
      },
    });
  }

  // ============== Insights ==============

  async getInsights(
    objectId: string,
    accessToken: string,
    params?: {
      date_preset?: string;
      time_range?: { since: string; until: string };
      time_increment?: string; // '1' for daily, 'monthly', etc.
      level?: string; // 'campaign', 'adset', 'ad'
    },
  ): Promise<MetaInsightsData[]> {
    const queryParams = new URLSearchParams({
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,actions',
      access_token: accessToken,
    });

    if (params?.date_preset) {
      queryParams.append('date_preset', params.date_preset);
    }
    if (params?.time_range) {
      queryParams.append('time_range', JSON.stringify(params.time_range));
    }
    if (params?.time_increment) {
      queryParams.append('time_increment', params.time_increment);
    }
    if (params?.level) {
      queryParams.append('level', params.level);
    }

    const response = await this.graphRequest(
      `/${objectId}/insights?${queryParams.toString()}`,
    );
    return response.data || [];
  }

  // ============== Helper ==============

  private async graphRequest(
    path: string,
    options?: {
      method?: string;
      body?: Record<string, any>;
    },
  ): Promise<any> {
    const url = path.startsWith('http') ? path : `${this.graphUrl}${path}`;
    const method = options?.method || 'GET';

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (options?.body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    this.logger.debug(`Meta API ${method} ${url.split('?')[0]}`);

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (data.error) {
      this.logger.error(
        `Meta API error: ${data.error.message} (code: ${data.error.code})`,
      );
      throw new Error(
        data.error.error_user_msg || data.error.message || 'Meta API error',
      );
    }

    return data;
  }
}
