export type PanelAdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertPanelAdminUserParams = {
  email: string;
  password_hash: string;
  is_active?: boolean;
};
