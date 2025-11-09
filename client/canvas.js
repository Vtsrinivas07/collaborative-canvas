class CanvasManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.devicePixelRatio = window.devicePixelRatio || 1;
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    this.clear();
    this.hoveredOpId = null;
  }

  resize(){
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth;
    const h = rect.height || this.canvas.clientHeight;
    if (w > 0 && h > 0) {
      this.canvas.width = Math.floor(w * this.devicePixelRatio);
      this.canvas.height = Math.floor(h * this.devicePixelRatio);
      this.ctx.setTransform(this.devicePixelRatio,0,0,this.devicePixelRatio,0,0);
      if (this.history && this.history.length > 0) {
        this.redraw();
      }
    }
  }

  clear(){
    this.history = [];
    this.redoStack = [];
    this.redraw();
  }

  applyOp(op){
    this.history.push(op);
    this.redoStack = [];
    this.redraw();
  }

  removeOpById(opId){
    this.history = this.history.filter(o=>o.id!==opId);
    this.redraw();
  }

  removeOpsByUserId(userId){
    if (!userId) return;
    const initialLength = this.history.length;
    this.history = this.history.filter(o => {
      // Check both strict and loose equality in case of type mismatch
      return o.userId !== userId && o.userId != userId;
    });
    // Only redraw if something was actually removed
    if (this.history.length !== initialLength) {
      this.redraw();
    }
  }

  redraw(){
    const ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for(const op of this.history) this.drawStroke(op, op.id === this.hoveredOpId);
  }

  drawStroke(op, highlight=false){
    const ctx = this.ctx;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if(op.type === 'erase'){
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = op.color;
    }
    ctx.lineWidth = op.size;
    ctx.beginPath();
    const p0 = op.points[0];
    ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<op.points.length;i++){
      const p = op.points[i];
      ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
    ctx.closePath();

    if(highlight){
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = Math.max(2, (op.size || 4) + 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(p0.x,p0.y);
      for(let i=1;i<op.points.length;i++){
        ctx.lineTo(op.points[i].x, op.points[i].y);
      }
      ctx.stroke();
      ctx.closePath();
    }
    ctx.restore();
  }

  hitTest(x,y, threshold=8){
    for(let i=this.history.length-1;i>=0;i--){
      const op = this.history[i];
      if(op.points && op.points.length>1){
        if(this._opHit(op, x, y, threshold)) return op;
      }
    }
    return null;
  }

  _opHit(op, x, y, threshold){
    for(let i=1;i<op.points.length;i++){
      const a = op.points[i-1];
      const b = op.points[i];
      if(pointToSegmentDistance({x,y}, a, b) <= threshold) return true;
    }
    return false;
  }

  setHovered(opId){
    if(this.hoveredOpId === opId) return;
    this.hoveredOpId = opId;
    this.redraw();
  }
}

function pointToSegmentDistance(P, A, B){
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const wx = P.x - A.x;
  const wy = P.y - A.y;
  const c1 = vx*wx + vy*wy;
  if(c1 <= 0) return Math.hypot(P.x - A.x, P.y - A.y);
  const c2 = vx*vx + vy*vy;
  if(c2 <= c1) return Math.hypot(P.x - B.x, P.y - B.y);
  const t = c1 / c2;
  const projx = A.x + t * vx;
  const projy = A.y + t * vy;
  return Math.hypot(P.x - projx, P.y - projy);
}

window.CanvasManager = CanvasManager;
