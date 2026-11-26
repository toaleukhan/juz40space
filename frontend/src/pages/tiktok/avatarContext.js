import { createContext } from 'react';
import api from '../../services/api';

// { [departmentId]: avatarVersion } — TikTokCompetition береді, DeptAvatar оқиды.
export const AvatarContext = createContext({});

export const avatarUrl = (id, version) =>
  `${api.defaults.baseURL}/tiktok/avatars/${id}?v=${version}`;

export const coverUrl = (videoId) => `${api.defaults.baseURL}/tiktok/covers/${encodeURIComponent(videoId)}`;
