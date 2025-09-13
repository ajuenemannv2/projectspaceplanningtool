// Test database connection and basic operations
import { db } from './config/database.js'

async function testDatabaseConnection() {
    console.log('🧪 Testing database connection...')
    
    try {
        // Test 1: Get all projects
        console.log('📋 Testing: Get all projects')
        const projects = await db.getProjects()
        console.log('✅ Projects retrieved:', projects.length)
        console.log('Projects:', projects.map(p => p.name))
        
        // Test 2: Get phases for first project
        if (projects.length > 0) {
            console.log('\n📋 Testing: Get phases for project', projects[0].name)
            const phases = await db.getProjectPhases(projects[0].id)
            console.log('✅ Phases retrieved:', phases.length)
            console.log('Phases:', phases.map(p => p.name))
        }
        
        // Test 3: Get spaces for first project
        if (projects.length > 0) {
            console.log('\n📋 Testing: Get spaces for project', projects[0].name)
            const spaces = await db.getProjectSpaces(projects[0].id)
            console.log('✅ Spaces retrieved:', spaces.length)
            console.log('Spaces:', spaces.map(s => s.space_name || s.space_id))
        }
        
        console.log('\n🎉 Database connection test completed successfully!')
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message)
        console.error('Full error:', error)
    }
}

// Run the test
testDatabaseConnection()
