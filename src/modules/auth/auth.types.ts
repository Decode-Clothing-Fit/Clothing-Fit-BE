export interface KakaoUserInfo {
    id: number;
    kakao_account?: {
        email?: string;
        profile?: {
            nickname?: string;
            profile_image_url?: string;
        }
    }
}

export interface SocialLoginResult {
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
}