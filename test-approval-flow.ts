import { ApprovalService } from './src/services/approval-service';

async function testApprovalFlow() {
  console.log('🔄 Testing Approval Flow...\n');
  
  const approvalService = new ApprovalService();
  
  try {
    // 1. Get review queue
    console.log('📋 Getting review queue...');
    const queueItems = await approvalService.getReviewQueue({ minScore: 0 });
    console.log(`Found ${queueItems.length} items in queue`);
    
    if (queueItems.length === 0) {
      console.log('❌ No items in queue to test');
      return;
    }
    
    // 2. Take first project item
    const projectItem = queueItems.find(item => item.type === 'project') || queueItems[0];
    console.log(`\n🎯 Testing with item: ${projectItem.title}`);
    console.log(`   Type: ${projectItem.type}`);
    console.log(`   ID: ${projectItem.id}`);
    console.log(`   Score: ${projectItem.quality_score}`);
    
    // 3. Approve the item
    console.log('\n✅ Approving item...');
    const result = await approvalService.approveContent(
      projectItem.id,
      'test-user',
      'Test approval to verify flow'
    );
    
    if (result.success) {
      console.log(`✅ SUCCESS! Item approved and moved to: ${result.targetTable}`);
      console.log(`   Item ID: ${result.itemId}`);
      console.log(`   Target table: ${result.targetTable}`);
    } else {
      console.log(`❌ FAILED: ${result.error}`);
    }
    
    // 4. Get updated stats
    console.log('\n📊 Updated Stats:');
    const stats = await approvalService.getStats();
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Approved: ${stats.approved}`);
    console.log(`   Rejected: ${stats.rejected}`);
    console.log(`   Auto-approved: ${stats.autoApproved}`);
    console.log(`   Avg Quality Score: ${stats.avgQualityScore}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testApprovalFlow();