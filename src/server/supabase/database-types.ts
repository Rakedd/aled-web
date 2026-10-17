
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_log_entries": {
                  Row: {
                    "created_at": string,"id": string,"job_application_id": string,"kind": Database["public"]['Enums']["activity_kind"],"occurred_at": string,"summary": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_application_id": string,"kind": Database["public"]['Enums']["activity_kind"],"occurred_at"?: string,"summary": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_application_id"?: string,"kind"?: Database["public"]['Enums']["activity_kind"],"occurred_at"?: string,"summary"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_entries_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "activity_log_entries_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"alert_snoozes": {
                  Row: {
                    "alert_kind": Database["public"]['Enums']["alert_kind"],"created_at": string,"id": string,"job_application_id": string,"snoozed_until": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_kind": Database["public"]['Enums']["alert_kind"],"created_at"?: string,"id"?: string,"job_application_id": string,"snoozed_until": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "alert_kind"?: Database["public"]['Enums']["alert_kind"],"created_at"?: string,"id"?: string,"job_application_id"?: string,"snoozed_until"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_snoozes_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "alert_snoozes_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"intermediary_id": string | null,"linkedin_url": string | null,"normalized_name": string,"phone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"intermediary_id"?: string | null,"linkedin_url"?: string | null,"normalized_name": string,"phone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"intermediary_id"?: string | null,"linkedin_url"?: string | null,"normalized_name"?: string,"phone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"end_clients": {
                  Row: {
                    "brief_generated_at": string | null,"brief_markdown": string | null,"brief_sources": Json | null,"created_at": string,"id": string,"name": string,"normalized_name": string,"notes": string | null,"parent_end_client_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_generated_at"?: string | null,"brief_markdown"?: string | null,"brief_sources"?: Json | null,"created_at"?: string,"id"?: string,"name": string,"normalized_name": string,"notes"?: string | null,"parent_end_client_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "brief_generated_at"?: string | null,"brief_markdown"?: string | null,"brief_sources"?: Json | null,"created_at"?: string,"id"?: string,"name"?: string,"normalized_name"?: string,"notes"?: string | null,"parent_end_client_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "end_clients_user_id_parent_end_client_id_fkey"
      columns: ["user_id","parent_end_client_id"]
isOneToOne: false
      referencedRelation: "end_clients"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"intermediaries": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["intermediary_kind"] | null,"name": string,"normalized_name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["intermediary_kind"] | null,"name": string,"normalized_name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["intermediary_kind"] | null,"name"?: string,"normalized_name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"interviews": {
                  Row: {
                    "created_at": string,"format": Database["public"]['Enums']["interview_format"],"id": string,"job_application_id": string,"kind": Database["public"]['Enums']["interview_kind"],"notes": string | null,"participants": string | null,"starts_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"format": Database["public"]['Enums']["interview_format"],"id"?: string,"job_application_id": string,"kind": Database["public"]['Enums']["interview_kind"],"notes"?: string | null,"participants"?: string | null,"starts_at": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"format"?: Database["public"]['Enums']["interview_format"],"id"?: string,"job_application_id"?: string,"kind"?: Database["public"]['Enums']["interview_kind"],"notes"?: string | null,"participants"?: string | null,"starts_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interviews_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "interviews_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"job_applications": {
                  Row: {
                    "actual_start_date": string | null,"applied_on": string,"contact_id": string | null,"created_at": string,"desired_start": string | null,"duration": string | null,"end_client_id": string | null,"id": string,"intermediary_id": string | null,"location": string | null,"notes": string | null,"posted_daily_rate": number | null,"posting_raw_text": string | null,"posting_url": string | null,"remote_policy": string | null,"requested_daily_rate": number | null,"source": string | null,"stack": NonNullable<Json>,"status": Database["public"]['Enums']["job_application_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_start_date"?: string | null,"applied_on"?: string,"contact_id"?: string | null,"created_at"?: string,"desired_start"?: string | null,"duration"?: string | null,"end_client_id"?: string | null,"id"?: string,"intermediary_id"?: string | null,"location"?: string | null,"notes"?: string | null,"posted_daily_rate"?: number | null,"posting_raw_text"?: string | null,"posting_url"?: string | null,"remote_policy"?: string | null,"requested_daily_rate"?: number | null,"source"?: string | null,"stack"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["job_application_status"],"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "actual_start_date"?: string | null,"applied_on"?: string,"contact_id"?: string | null,"created_at"?: string,"desired_start"?: string | null,"duration"?: string | null,"end_client_id"?: string | null,"id"?: string,"intermediary_id"?: string | null,"location"?: string | null,"notes"?: string | null,"posted_daily_rate"?: number | null,"posting_raw_text"?: string | null,"posting_url"?: string | null,"remote_policy"?: string | null,"requested_daily_rate"?: number | null,"source"?: string | null,"stack"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["job_application_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_applications_user_id_contact_id_fkey"
      columns: ["user_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "job_applications_user_id_end_client_id_fkey"
      columns: ["user_id","end_client_id"]
isOneToOne: false
      referencedRelation: "end_clients"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "job_applications_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"job_specs": {
                  Row: {
                    "created_at": string,"id": string,"job_application_id": string,"pending_stack": Json | null,"raw_text": string | null,"source_kind": Database["public"]['Enums']["job_spec_source_kind"],"storage_path": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_application_id": string,"pending_stack"?: Json | null,"raw_text"?: string | null,"source_kind": Database["public"]['Enums']["job_spec_source_kind"],"storage_path"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_application_id"?: string,"pending_stack"?: Json | null,"raw_text"?: string | null,"source_kind"?: Database["public"]['Enums']["job_spec_source_kind"],"storage_path"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_specs_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: true
      referencedRelation: "job_applications"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "job_specs_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: true
      referencedRelation: "job_applications_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "anthropic_api_key_last_four": string | null,"created_at": string,"email": string | null,"encrypted_anthropic_api_key": string | null,"first_name": string | null,"follow_up_delay_days": number,"id": string,"last_name": string | null,"links": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anthropic_api_key_last_four"?: string | null,"created_at"?: string,"email"?: string | null,"encrypted_anthropic_api_key"?: string | null,"first_name"?: string | null,"follow_up_delay_days"?: number,"id": string,"last_name"?: string | null,"links"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "anthropic_api_key_last_four"?: string | null,"created_at"?: string,"email"?: string | null,"encrypted_anthropic_api_key"?: string | null,"first_name"?: string | null,"follow_up_delay_days"?: number,"id"?: string,"last_name"?: string | null,"links"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "job_applications_overview": {
                  Row: {
                    "actual_start_date": string | null,"applied_on": string | null,"contact_id": string | null,"contact_name": string | null,"created_at": string | null,"desired_start": string | null,"duration": string | null,"end_client_id": string | null,"end_client_name": string | null,"end_client_parent_name": string | null,"has_job_spec": boolean | null,"id": string | null,"intermediary_id": string | null,"intermediary_kind": Database["public"]['Enums']["intermediary_kind"] | null,"intermediary_name": string | null,"last_activity_at": string | null,"location": string | null,"notes": string | null,"posted_daily_rate": number | null,"posting_raw_text": string | null,"posting_url": string | null,"remote_policy": string | null,"requested_daily_rate": number | null,"source": string | null,"stack": Json | null,"status": Database["public"]['Enums']["job_application_status"] | null,"title": string | null,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "job_applications_user_id_contact_id_fkey"
      columns: ["user_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "job_applications_user_id_end_client_id_fkey"
      columns: ["user_id","end_client_id"]
isOneToOne: false
      referencedRelation: "end_clients"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "job_applications_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries"
      referencedColumns: ["user_id","id"]
    }
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "activity_kind": "call"|"message"|"email"|"status_change"|"other","alert_kind": "follow_up_due"|"job_spec_missing"|"end_client_unknown"|"upcoming_interview"|"no_news_suggestion","intermediary_kind": "agency"|"esn"|"platform"|"direct"|"other","interview_format": "video"|"onsite"|"phone","interview_kind": "client"|"mock"|"other","job_application_status": "applied"|"intermediary_contact"|"cv_submitted"|"interview_scheduled"|"interview_done"|"contract_received"|"signed"|"ko_after_contact"|"ko_cv"|"ko_interview"|"no_news_abandoned","job_spec_source_kind": "pdf"|"text"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activity_kind": ["call", "message", "email", "status_change", "other"],"alert_kind": ["follow_up_due", "job_spec_missing", "end_client_unknown", "upcoming_interview", "no_news_suggestion"],"intermediary_kind": ["agency", "esn", "platform", "direct", "other"],"interview_format": ["video", "onsite", "phone"],"interview_kind": ["client", "mock", "other"],"job_application_status": ["applied", "intermediary_contact", "cv_submitted", "interview_scheduled", "interview_done", "contract_received", "signed", "ko_after_contact", "ko_cv", "ko_interview", "no_news_abandoned"],"job_spec_source_kind": ["pdf", "text"]
          }
        }
} as const
