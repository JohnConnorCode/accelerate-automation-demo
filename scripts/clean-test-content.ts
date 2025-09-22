#!/usr/bin/env tsx

/**
 * Remove all test content from database
 */

import { supabase } from '../src/lib/supabase-client';

async function cleanTestContent() {
  console.log('🧹 Removing all test content from database...\n');

  try {
    // Get all items from content_queue
    const { data: items, error } = await supabase
      .from('content_queue')
      .select('*');

    if (error) throw error;

    if (!items || items.length === 0) {
      console.log('No items in database');
      return;
    }

    console.log(`Found ${items.length} items to check\n`);

    const toDelete: string[] = [];
    const toKeep: any[] = [];

    // Identify test content
    for (const item of items) {
      const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();

      // Check for test indicators
      const isTest =
        text.includes('test project') ||
        text.includes('test grant') ||
        text.includes('test resource') ||
        text.includes('test content') ||
        text.includes('sample project') ||
        text.includes('sample grant') ||
        text.includes('example project') ||
        (item.title && /test.*\d{10,}/.test(item.title.toLowerCase())); // Test with timestamp

      if (isTest) {
        toDelete.push(item.id);
        console.log(`🗑️  Test content: "${item.title || item.url || 'Untitled'}"`);
      } else {
        toKeep.push(item);
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   ✅ Real content to KEEP: ${toKeep.length}`);
    console.log(`   🗑️  Test content to DELETE: ${toDelete.length}`);

    if (toDelete.length > 0) {
      console.log(`\n🗑️  DELETING ${toDelete.length} test items...`);

      const { error: deleteError } = await supabase
        .from('content_queue')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error('Delete error:', deleteError);
      } else {
        console.log('✅ Test content removed!');
      }
    } else {
      console.log('\n✅ No test content found!');
    }

    // Show what remains
    if (toKeep.length > 0) {
      console.log('\n📋 REMAINING CONTENT:');
      for (const item of toKeep.slice(0, 10)) {
        console.log(`   • ${item.title || item.url}`);
      }
      if (toKeep.length > 10) {
        console.log(`   ... and ${toKeep.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanTestContent();