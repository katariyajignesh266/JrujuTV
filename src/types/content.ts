// src/types/content.ts
export interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  channelAvatarUrl: string;
  viewCount: number;
  publishedAt: string;
  duration: string;
  sourceUrl: string;
}

export interface Channel {
  id: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
  videoCount: number;
  sourceUrl: string;
}

export interface Short extends Pick<Video, 'id' | 'title' | 'thumbnailUrl' | 'channelName' | 'viewCount' | 'sourceUrl'> {}

