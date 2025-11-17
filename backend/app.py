from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'fusioncore-secret-key-2024'

# Mock user database
users = {
    'admin': {'password': 'admin123', 'role': 'administrator', 'username': 'admin'},
    'user': {'password': 'user123', 'role': 'analyst', 'username': 'user'},
    'operator': {'password': 'operator123', 'role': 'operator', 'username': 'operator'}
}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['user']
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    print(f"Login attempt: {username}")
    
    if username in users and users[username]['password'] == password:
        user_data = {
            'username': username,
            'role': users[username]['role']
        }
        token = jwt.encode({
            'user': user_data,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        print(f"Login successful for: {username}")
        return jsonify({
            'success': True,
            'token': token,
            'user': user_data
        })
    
    print(f"Login failed for: {username}")
    return jsonify({
        'success': False,
        'message': 'Invalid credentials'
    }), 401

@app.route('/api/dashboard', methods=['GET'])
@token_required
def get_dashboard(current_user):
    return jsonify({
        'total_events': 156,
        'total_correlations': 42,
        'sigint_events': 98,
        'buas_events': 58,
        'recent_events': 23
    })

@app.route('/api/events', methods=['GET'])
@token_required
def get_events(current_user):
    return jsonify({
        'events': [
            {
                'id': 1,
                'event_type': 'SIGINT',
                'description': 'Encrypted signal intercept - Pattern analysis required',
                'latitude': 9.0820,
                'longitude': 8.6753,
                'confidence': 3,
                'source_id': 'SIG_45872',
                'timestamp': '2024-01-14T10:30:00Z',
                'correlation_count': 3
            },
            {
                'id': 2,
                'event_type': 'BUAS',
                'description': 'Unauthorized drone surveillance activity detected',
                'latitude': 9.1820,
                'longitude': 8.7753,
                'confidence': 2,
                'source_id': 'BUAS_39164',
                'timestamp': '2024-01-14T11:15:00Z',
                'correlation_count': 2
            },
            {
                'id': 3,
                'event_type': 'SIGINT',
                'description': 'High-frequency transmission - Potential threat',
                'latitude': 9.2820,
                'longitude': 8.8753,
                'confidence': 3,
                'source_id': 'SIG_72651',
                'timestamp': '2024-01-14T12:45:00Z',
                'correlation_count': 1
            },
            {
                'id': 4,
                'event_type': 'BUAS',
                'description': 'Multiple drone swarm formation detected',
                'latitude': 9.3820,
                'longitude': 8.9753,
                'confidence': 3,
                'source_id': 'BUAS_18395',
                'timestamp': '2024-01-14T13:20:00Z',
                'correlation_count': 4
            }
        ]
    })

@app.route('/api/correlations', methods=['GET'])
@token_required
def get_correlations(current_user):
    return jsonify({
        'correlations': [
            {
                'event1_id': 1,
                'event2_id': 2,
                'correlation_type': 'SIGINT-BUAS',
                'confidence': 0.85,
                'event1_desc': 'Encrypted signal intercept',
                'event2_desc': 'Drone surveillance activity'
            },
            {
                'event1_id': 1,
                'event2_id': 3,
                'correlation_type': 'SIGINT-SIGINT',
                'confidence': 0.92,
                'event1_desc': 'Encrypted signal intercept',
                'event2_desc': 'High-frequency transmission'
            },
            {
                'event1_id': 2,
                'event2_id': 4,
                'correlation_type': 'BUAS-BUAS',
                'confidence': 0.78,
                'event1_desc': 'Drone surveillance activity',
                'event2_desc': 'Multiple drone swarm'
            },
            {
                'event1_id': 3,
                'event2_id': 4,
                'correlation_type': 'SIGINT-BUAS',
                'confidence': 0.67,
                'event1_desc': 'High-frequency transmission',
                'event2_desc': 'Multiple drone swarm'
            }
        ]
    })

@app.route('/api/events', methods=['POST'])
@token_required
def create_event(current_user):
    data = request.get_json()
    print(f"New event created by {current_user['username']}: {data}")
    return jsonify({
        'success': True,
        'message': 'Intelligence event submitted successfully',
        'event': {
            'id': len(data) + 5,  # Mock ID
            **data,
            'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
            'correlation_count': 0
        }
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'Fusion Core API'})

if __name__ == '__main__':
    print("🚀 Starting FUSION CORE Backend Server...")
    print("📍 API running on: http://localhost:5001")
    print("🔐 Available credentials:")
    print("   - admin / admin123 (Administrator)")
    print("   - user / user123 (Analyst)")
    print("   - operator / operator123 (Operator)")
    app.run(debug=True, port=5001, host='0.0.0.0')
