# app.py
from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import date
import os
from apscheduler.executors.pool import ThreadPoolExecutor, ProcessPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import requests

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

def archive_tasks():
    with app.app_context():
        # Check last archive date
        last_archived_date = ArchiveInfo.get_last_archive()
        today = date.today()

        # If the last archive was not today, archive and update the record
        if last_archived_date is None or last_archived_date != today:
            # Perform the archive
            tasks = Task.query.filter(Task.status == 'finished')
            for task in tasks:
                task.status = 'archived'
            db.session.commit()

            # Update the archive info in the database
            ArchiveInfo.update_last_archive(today)
            logging.info(f"Archived tasks for {today}")
        

# Configure logging
logging.basicConfig(level=logging.INFO)
logging.getLogger('apscheduler').setLevel(logging.DEBUG)

# Initialize the scheduler
executors = {
    'default': ThreadPoolExecutor(20),
    'processpool': ProcessPoolExecutor(5)
}

job_defaults = {
    'coalesce': True, 
    'max_instances': 1
}

scheduler = BackgroundScheduler(executors=executors, job_defaults=job_defaults)
scheduler.add_job(archive_tasks, 'cron', hour=0, minute=0)  # Runs at 12:00 AM
# Periodic job to check every 15 minutes if archiving was missed
scheduler.add_job(archive_tasks, 'interval', minutes=15)
scheduler.start()

# Models
class ArchiveInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    last_archive = db.Column(db.Date, nullable=False)

    @staticmethod
    def get_last_archive():
        archive_info = ArchiveInfo.query.first()
        if archive_info:
            return archive_info.last_archive
        return None

    @staticmethod
    def update_last_archive(new_archive_date):
        archive_info = ArchiveInfo.query.first()
        if not archive_info:
            archive_info = ArchiveInfo(last_archive=new_archive_date)
            db.session.add(archive_info)
        else:
            archive_info.last_archive = new_archive_date
        db.session.commit()

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    completion_date = db.Column(db.Date)
    column = db.Column(db.String(20), default='To Do')
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'status': self.status,
            'completion_date': self.completion_date.isoformat() if self.completion_date else None,
            'column': self.column
        }

class Habit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    #days that the habit is available
    days = db.Column(db.String(100))  # Store as comma-separated string
    #list of completed dates
    dates = db.relationship('HabitDate', backref='habit', lazy=True)

class HabitDate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)

class JournalEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, nullable=False)
    ai_comment = db.Column(db.Text)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/yearly-grid')
def yearly_grid():
    return render_template('yearly_grid.html')

# API routes
@app.route('/api/tasks', methods=['GET', 'POST'])
def handle_tasks():
    '''
    POST request: Creates a new task in the database and returns its details.
    GET  request: Retrieves and returns all tasks from the database as a list in JSON format.
    '''
    if request.method == 'POST':
        data = request.json
        new_task = Task(
            title=data['title'],
            status=data['status'],
            column=data.get('column', 'To Do')
        )
        db.session.add(new_task)
        db.session.commit()
        return jsonify(id=new_task.id, title=new_task.title, status=new_task.status, column=new_task.column)
    else:
        tasks = Task.query.all()
        return jsonify([{
            'id': task.id,
            'title': task.title,
            'status': task.status,
            'completion_date': str(task.completion_date) if task.completion_date else None,
            'column': task.column
        } for task in tasks])

@app.route('/api/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    if request.method == 'PUT':
        data = request.json
        if 'title' in data and not data['title'].strip():
            # If the title is empty, delete the task
            db.session.delete(task)
            db.session.commit()
            return jsonify({'success': True, 'deleted': True})
        else:
            task.title = data.get('title', task.title)
            task.status = data.get('status', task.status)
            task.column = data.get('column', task.column)
            if data.get('status') == 'finished':
                task.completion_date = date.today()
            else:
                task.completion_date = None
            db.session.commit()
            return jsonify({'success': True, 'deleted': False})
    elif request.method == 'DELETE':
        db.session.delete(task)
        db.session.commit()
        return jsonify({'success': True})
    
@app.route('/api/tasks/archive', methods=["POST"])
def archive_completed_tasks():
    tasks = Task.query.filter(Task.status == 'finished')
    for task in tasks:
        task.status = 'archived'
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/habits', methods=['GET', 'POST'])
def handle_habits():
    '''
    POST request: Creates a new habit in db and returns related JSON
    GET  request: Returns a JSON of all habits and related fields
    '''
    if request.method == 'POST':
        data = request.json
        new_habit = Habit(name=data['name'], days=','.join(data.get('days', [])))
        db.session.add(new_habit)
        db.session.commit()
        return jsonify(id=new_habit.id, name=new_habit.name, days=new_habit.days.split(','))
    else:
        habits = Habit.query.all()
        return jsonify([{
            'id': habit.id,
            'name': habit.name,
            'days': habit.days.split(',') if habit.days else []
        } for habit in habits])
        
@app.route('/api/tasks/order', methods=['PUT'])
def update_task_order():
    data = request.json
    task_id = data.get('taskId')
    new_order = data.get('newOrder')
    new_status = data.get('newStatus')
    
    if not task_id or new_order is None:
        return jsonify({'success': False, 'error': 'Missing taskId or newOrder'}), 400
    
    try:
        task = Task.query.get(task_id)
        if task:
            if new_status and new_status != task.status:
                # If the status has changed, move the task to the end of the new status
                max_order = db.session.query(db.func.max(Task.order)).filter(Task.status == new_status).scalar() or 0
                task.order = max_order + 1
                task.status = new_status
            else:
                # Otherwise, just update the order
                task.order = new_order
            
            db.session.commit()
            return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/habits/<int:habit_id>', methods=['PUT', 'DELETE'])
def update_habit(habit_id):
    '''
    PUT    request: Change Habit name and days
    DELETE request: Delete the habit
    '''
    try:
        habit = Habit.query.get_or_404(habit_id)
        if request.method == 'PUT':
            data = request.json
            if 'name' in data:
                habit.name = data['name']
            if 'days' in data:
                habit.days = ','.join(map(str, data['days']))
            if 'toggle_date' in data:
                toggle_date = date.fromisoformat(data['toggle_date'])
                existing_date = HabitDate.query.filter_by(habit_id=habit.id, date=toggle_date).first()
                if existing_date:
                    db.session.delete(existing_date)
                else:
                    new_date = HabitDate(habit_id=habit.id, date=toggle_date)
                    db.session.add(new_date)
            db.session.commit()
            return jsonify({'success': True})
        elif request.method == 'DELETE':
            db.session.delete(habit)
            db.session.commit()
            return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"An error occurred while updating habit {habit_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/journal', methods=['GET', 'POST'])
def handle_journal():
    if request.method == 'POST':
        data = request.json
        new_entry = JournalEntry(
            title=data['title'],
            content=data['content'],
            date=date.today(),
            ai_comment=data.get('ai_comment', '')
        )
        db.session.add(new_entry)
        db.session.commit()
        return jsonify(id=new_entry.id, title=new_entry.title, content=new_entry.content, date=str(new_entry.date), ai_comment=new_entry.ai_comment)
    else:
        entries = JournalEntry.query.all()
        return jsonify([{
            'id': entry.id,
            'title': entry.title,
            'content': entry.content,
            'date': str(entry.date),
            'ai_comment': entry.ai_comment
        } for entry in entries])

@app.route('/api/journal/<int:entry_id>', methods=['PUT', 'DELETE'])
def update_journal(entry_id):
    entry = JournalEntry.query.get_or_404(entry_id)
    if request.method == 'PUT':
        data = request.json
        entry.title = data.get('title', entry.title)
        entry.content = data.get('content', entry.content)
        entry.ai_comment = data.get('ai_comment', entry.ai_comment)
        db.session.commit()
        return jsonify({'success': True})
    elif request.method == 'DELETE':
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True})

@app.route('/api/history', methods=['GET'])
def get_yearly_data():
    habits = Habit.query.all()
    tasks = Task.query.filter(Task.completion_date.isnot(None)).all()
    journal_entries = JournalEntry.query.all()
    
    yearly_data = {}
    
    for habit in habits:
        habit_dates = HabitDate.query.filter_by(habit_id=habit.id).all()
        for habit_date in habit_dates:
            date_str = str(habit_date.date)
            if date_str not in yearly_data:
                yearly_data[date_str] = {"completedHabits": [], "completedTasks": [], "journalEntries": []}
            yearly_data[date_str]["completedHabits"].append(habit.name)
    
    for task in tasks:
        date_str = str(task.completion_date)
        if date_str not in yearly_data:
            yearly_data[date_str] = {"completedHabits": [], "completedTasks": [], "journalEntries": []}
        yearly_data[date_str]["completedTasks"].append(task.title)
    
    for entry in journal_entries:
        date_str = str(entry.date)
        if date_str not in yearly_data:
            yearly_data[date_str] = {"completedHabits": [], "completedTasks": [], "journalEntries": []}
        yearly_data[date_str]["journalEntries"].append(entry.title)
    
    for date_str, data in yearly_data.items():
        total_habits = len(habits)
        completed_habits = len(data["completedHabits"])
        data["completionRate"] = completed_habits / total_habits if total_habits > 0 else 0
    
    # Return the data with date strings as keys
    return jsonify(yearly_data)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)