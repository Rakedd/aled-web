
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_log_entries": {
                  Row: {
                    "contact_id": string | null,"created_at": string,"id": string,"job_application_id": string | null,"kind": Database["public"]['Enums']["activity_kind"],"occurred_at": string,"summary": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id"?: string | null,"created_at"?: string,"id"?: string,"job_application_id"?: string | null,"kind": Database["public"]['Enums']["activity_kind"],"occurred_at"?: string,"summary": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "contact_id"?: string | null,"created_at"?: string,"id"?: string,"job_application_id"?: string | null,"kind"?: Database["public"]['Enums']["activity_kind"],"occurred_at"?: string,"summary"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_entries_user_id_contact_id_fkey"
      columns: ["user_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "activity_log_entries_user_id_contact_id_fkey"
      columns: ["user_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts_overview"
      referencedColumns: ["user_id","id"]
    },{
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
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"intermediary_id": string | null,"linkedin_url": string | null,"normalized_name": string,"notes": string | null,"phone": string | null,"referred_by": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"intermediary_id"?: string | null,"linkedin_url"?: string | null,"normalized_name": string,"notes"?: string | null,"phone"?: string | null,"referred_by"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"intermediary_id"?: string | null,"linkedin_url"?: string | null,"normalized_name"?: string,"notes"?: string | null,"phone"?: string | null,"referred_by"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "contacts_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"end_client_briefs": {
                  Row: {
                    "end_client_id": string,"generated_at": string,"id": string,"language": string,"markdown": string,"sources": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_client_id": string,"generated_at": string,"id"?: string,"language": string,"markdown": string,"sources"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "end_client_id"?: string,"generated_at"?: string,"id"?: string,"language"?: string,"markdown"?: string,"sources"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "end_client_briefs_user_id_end_client_id_fkey"
      columns: ["user_id","end_client_id"]
isOneToOne: false
      referencedRelation: "end_clients"
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
                },"interview_questions": {
                  Row: {
                    "generated_at": string,"id": string,"job_application_id": string,"language": string,"questions": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "generated_at": string,"id"?: string,"job_application_id": string,"language": string,"questions": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "generated_at"?: string,"id"?: string,"job_application_id"?: string,"language"?: string,"questions"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_questions_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "interview_questions_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications_overview"
      referencedColumns: ["user_id","id"]
    }
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
      foreignKeyName: "job_applications_user_id_contact_id_fkey"
      columns: ["user_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts_overview"
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
    },{
      foreignKeyName: "job_applications_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries_overview"
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
                },"opportunities": {
                  Row: {
                    "company": string | null,"country": string | null,"currency": string | null,"description": string | null,"duration_months": number | null,"external_id": string,"id": string,"location_label": string | null,"published_at": string,"rate_label": string | null,"rate_max": number | null,"rate_min": number | null,"received_at": string,"region": string | null,"remote_mode": string | null,"skills": NonNullable<Json>,"source": string,"title": string,"title_normalized": string,"updated_at": string | null,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company"?: string | null,"country"?: string | null,"currency"?: string | null,"description"?: string | null,"duration_months"?: number | null,"external_id": string,"id"?: string,"location_label"?: string | null,"published_at": string,"rate_label"?: string | null,"rate_max"?: number | null,"rate_min"?: number | null,"received_at"?: string,"region"?: string | null,"remote_mode"?: string | null,"skills"?: NonNullable<Json>,"source": string,"title": string,"title_normalized": string,"updated_at"?: string | null,"url": string
                  }
                  Update: {
                    "company"?: string | null,"country"?: string | null,"currency"?: string | null,"description"?: string | null,"duration_months"?: number | null,"external_id"?: string,"id"?: string,"location_label"?: string | null,"published_at"?: string,"rate_label"?: string | null,"rate_max"?: number | null,"rate_min"?: number | null,"received_at"?: string,"region"?: string | null,"remote_mode"?: string | null,"skills"?: NonNullable<Json>,"source"?: string,"title"?: string,"title_normalized"?: string,"updated_at"?: string | null,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"opportunity_decisions": {
                  Row: {
                    "decided_at": string,"decision": string,"id": string,"job_application_id": string | null,"opportunity_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "decided_at"?: string,"decision": string,"id"?: string,"job_application_id"?: string | null,"opportunity_id": string,"user_id": string
                  }
                  Update: {
                    "decided_at"?: string,"decision"?: string,"id"?: string,"job_application_id"?: string | null,"opportunity_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_decisions_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_decisions_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "opportunity_decisions_user_id_job_application_id_fkey"
      columns: ["user_id","job_application_id"]
isOneToOne: false
      referencedRelation: "job_applications_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"opportunity_filters": {
                  Row: {
                    "always_exclude_keywords": (string)[],"created_at": string,"disabled_sources": (string)[],"id": string,"include_keywords": (string)[],"rate_floor_full_remote": number | null,"rate_floor_hybrid": number | null,"rate_floor_onsite": number | null,"regions": (string)[],"rescuable_exclude_keywords": (string)[],"rescue_keywords": (string)[],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "always_exclude_keywords"?: (string)[],"created_at"?: string,"disabled_sources"?: (string)[],"id"?: string,"include_keywords"?: (string)[],"rate_floor_full_remote"?: number | null,"rate_floor_hybrid"?: number | null,"rate_floor_onsite"?: number | null,"regions"?: (string)[],"rescuable_exclude_keywords"?: (string)[],"rescue_keywords"?: (string)[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "always_exclude_keywords"?: (string)[],"created_at"?: string,"disabled_sources"?: (string)[],"id"?: string,"include_keywords"?: (string)[],"rate_floor_full_remote"?: number | null,"rate_floor_hybrid"?: number | null,"rate_floor_onsite"?: number | null,"regions"?: (string)[],"rescuable_exclude_keywords"?: (string)[],"rescue_keywords"?: (string)[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "anthropic_api_key_last_four": string | null,"created_at": string,"email": string | null,"encrypted_anthropic_api_key": string | null,"first_name": string | null,"follow_up_delay_days": number,"id": string,"last_name": string | null,"links": NonNullable<Json>,"opportunities_last_viewed_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anthropic_api_key_last_four"?: string | null,"created_at"?: string,"email"?: string | null,"encrypted_anthropic_api_key"?: string | null,"first_name"?: string | null,"follow_up_delay_days"?: number,"id": string,"last_name"?: string | null,"links"?: NonNullable<Json>,"opportunities_last_viewed_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "anthropic_api_key_last_four"?: string | null,"created_at"?: string,"email"?: string | null,"encrypted_anthropic_api_key"?: string | null,"first_name"?: string | null,"follow_up_delay_days"?: number,"id"?: string,"last_name"?: string | null,"links"?: NonNullable<Json>,"opportunities_last_viewed_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "contacts_overview": {
                  Row: {
                    "created_at": string | null,"email": string | null,"full_name": string | null,"id": string | null,"intermediary_id": string | null,"intermediary_name": string | null,"last_exchange_at": string | null,"linkedin_url": string | null,"normalized_name": string | null,"notes": string | null,"phone": string | null,"proposed_mission_count": number | null,"referred_by": string | null,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "contacts_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "contacts_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"exchanges_overview": {
                  Row: {
                    "contact_intermediary_id": string | null,"contact_name": string | null,"created_at": string | null,"effective_contact_id": string | null,"id": string | null,"job_application_id": string | null,"job_application_intermediary_id": string | null,"job_application_title": string | null,"kind": Database["public"]['Enums']["activity_kind"] | null,"occurred_at": string | null,"summary": string | null,"user_id": string | null
                  }
                  ComputedFields: never
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
                },"intermediaries_overview": {
                  Row: {
                    "contact_count": number | null,"created_at": string | null,"id": string | null,"kind": Database["public"]['Enums']["intermediary_kind"] | null,"last_exchange_at": string | null,"name": string | null,"proposed_mission_count": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "contact_count"?: never,"created_at"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["intermediary_kind"] | null,"last_exchange_at"?: never,"name"?: string | null,"proposed_mission_count"?: never,"user_id"?: string | null
                         }
                        Update: {
                           "contact_count"?: never,"created_at"?: string | null,"id"?: string | null,"kind"?: Database["public"]['Enums']["intermediary_kind"] | null,"last_exchange_at"?: never,"name"?: string | null,"proposed_mission_count"?: never,"user_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"job_applications_overview": {
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
      foreignKeyName: "job_applications_user_id_contact_id_fkey"
      columns: ["user_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts_overview"
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
    },{
      foreignKeyName: "job_applications_user_id_intermediary_id_fkey"
      columns: ["user_id","intermediary_id"]
isOneToOne: false
      referencedRelation: "intermediaries_overview"
      referencedColumns: ["user_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "assign_missing_contact_intermediaries":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"delete_contact":
{ Args: { "target_contact_id": string }; Returns: boolean
                           }
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
