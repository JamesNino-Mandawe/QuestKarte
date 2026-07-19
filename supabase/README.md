# QuestKarte Supabase setup

The schema uses a unified account model: every person can post tasks and apply for tasks. Student and professional labels are optional verification badges, not account types.

## First-time setup

1. Create a free project at [Supabase](https://supabase.com/dashboard).
2. In the project dashboard, open **SQL Editor** and create a new query.
3. Copy the complete contents of `schema.sql`, paste it into the editor, and choose **Run**.
4. In **Authentication > Providers**, enable Email. For a classroom prototype, email/password is enough; add Google later only if needed.
5. Create your first account through the eventual app sign-up screen. Supabase automatically creates its matching profile and ordinary `user` role.
6. In **Authentication > Users**, copy the account UUID. In SQL Editor, run:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('PASTE-USER-UUID-HERE', 'super_admin');
   ```

   Use `admin` for your second administrator and `moderator` for a verification/safety reviewer.

## Trust ranks

| Trust Factor | Rank |
| --- | --- |
| 0-99 | Bronze Explorer |
| 100-249 | Silver Pathfinder |
| 250-499 | Gold Trusted |
| 500-999 | Platinum Reliable |
| 1,000+ | Certified Trusted |

Certified Trusted should be shown only when the person also has a verified identity, at least several completed tasks, and no active serious safety reports. The UI can calculate the rank from `profiles.trust_factor`.

## Safety decisions built into the schema

- Verification documents are stored in a private Storage bucket; they are never public URLs.
- Phone numbers are kept in a separate private-profile table, not in a public profile.
- Users may not directly edit their own trust score.
- Only staff can approve verification requests, change Trust Factor history, or resolve reports/disputes.
- Messages are visible only to members of the conversation.
- A report must target exactly one user, task, or message.

## What comes next in the codebase

When you create the Supabase project, provide only the Project URL and anon key (never the service-role key). Then we will add a local `.env` file, the Supabase client, real sign-up/sign-in, and connect the current screens one section at a time.

## Resetting test data

During classroom development, use `reset_test_data.sql` only when the team deliberately wants to delete every test account and every user-created record. It preserves the schema and default task categories. Do not build this command into the normal user interface and do not run it after real users start testing.
