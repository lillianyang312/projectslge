# Deploy Chatbot Function

The chatbot edge function needs to be deployed to Supabase. Follow these steps:

## Step 1: Login to Supabase CLI

```bash
supabase login
```

This will open a browser window for authentication.

## Step 2: Link Your Project

```bash
supabase link --project-ref wnerxlpanzosudbipvom
```

## Step 3: Deploy the Chatbot Function

```bash
supabase functions deploy chatbot
```

## Step 4: Set OpenAI API Key Secret

After deployment, you need to set the `OPENAI_API_KEY` secret:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

Replace `your_openai_api_key_here` with your actual OpenAI API key.

## Step 5: Verify Deployment

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wnerxlpanzosudbipvom
2. Navigate to **Edge Functions** in the left sidebar
3. You should see `chatbot` listed
4. Click on it to view logs and verify it's working

## Troubleshooting

### If you get "Authorization failed"
- Make sure you're logged in: `supabase login`
- Verify you have access to the project in the Supabase dashboard

### If you get "Function not found" after deployment
- Wait a few seconds for the deployment to propagate
- Check the Edge Functions page in the dashboard

### If you get 500 errors after deployment
- Check that `OPENAI_API_KEY` is set: `supabase secrets list`
- Verify the API key is valid
- Check function logs in the Supabase dashboard

