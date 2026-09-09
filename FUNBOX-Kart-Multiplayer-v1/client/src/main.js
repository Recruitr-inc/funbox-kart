import { SERVER_URL } from "./config.js";

let socket, myId, roomCode, playerName;
const remote = new Map();

const TRACK = {
  minX: 90, maxX: 1190, minY: 90, maxY: 630,
  checkpoints: [{x:640,y:115},{x:1090,y:360},{x:640,y:605},{x:190,y:360}]
};

class RaceScene extends Phaser.Scene {
  constructor(){super("RaceScene")}
  create(){
    this.cameras.main.setBackgroundColor("#10151b");
    const g=this.add.graphics();
    g.fillStyle(0x5d7f43).fillRect(0,0,1280,720);
    g.fillStyle(0x2d3034).fillRect(70,70,1140,580);
    g.lineStyle(70,0x20252b).strokeRect(105,105,1070,510);
    g.lineStyle(4,0xe8e8e8).strokeRect(140,140,1000,440);

    for(let x=160;x<1120;x+=40) {
      g.lineStyle(2,0x62676d).lineBetween(x,360,x+20,360);
    }
    this.add.text(18,18,"FUNBOX",{fontSize:"28px",fontStyle:"bold",color:"#ffffff"});
    this.info=this.add.text(18,52,"Recruitr™",{fontSize:"13px",color:"#ffffff"});
    this.leader=this.add.text(1010,18,"",{fontSize:"15px",color:"#fff",align:"right"});
    this.count=this.add.text(640,350,"",{fontSize:"64px",fontStyle:"bold",color:"#fff"}).setOrigin(.5);

    this.keys=this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT");
    this.cursors=this.keys;
    this.me={x:260,y:360,angle:0,speed:0,lap:1,checkpoint:0,finished:false};
    this.lastSend=0;

    socket.on("playerJoined",p=>remote.set(p.id,p));
    socket.on("playerState",p=>remote.set(p.id,p));
    socket.on("playerLeft",id=>remote.delete(id));
    socket.on("raceStart",()=>this.startCountdown());

    document.getElementById("menu").style.display="none";
    this.startCountdown();
  }
  startCountdown(){
    let n=3; this.count.setText(n);
    const t=this.time.addEvent({delay:700,repeat:3,callback:()=>{
      n--; this.count.setText(n>0?n:"GO!");
      if(n<0){this.count.setText(""); t.remove();}
    }});
  }
  update(time,delta){
    const dt=Math.min(delta,40)/16.67;
    let throttle=this.keys.UP.isDown, brake=this.keys.DOWN.isDown;
    if(throttle)this.me.speed+=0.24*dt;
    if(brake)this.me.speed-=0.32*dt;
    if(!throttle&&!brake)this.me.speed*=Math.pow(.94,dt);
    this.me.speed=Phaser.Math.Clamp(this.me.speed,-2.5,7.5);

    const steer=(this.keys.LEFT.isDown?-1:0)+(this.keys.RIGHT.isDown?1:0);
    const steerPower=.045*Math.min(Math.abs(this.me.speed)/2,1)*dt;
    this.me.angle+=steer*steerPower*(this.me.speed>=0?1:-1);
    this.me.x+=Math.cos(this.me.angle)*this.me.speed*dt;
    this.me.y+=Math.sin(this.me.angle)*this.me.speed*dt;

    if(this.me.x<145||this.me.x>1135||this.me.y<145||this.me.y>575){
      this.me.speed*=.72;
      this.me.x=Phaser.Math.Clamp(this.me.x,145,1135);
      this.me.y=Phaser.Math.Clamp(this.me.y,145,575);
    }

    this.me.checkpoint=this.getCheckpoint();
    if(this.me.checkpoint===0 && this.prevCheckpoint===3){
      this.me.lap++;
      if(this.me.lap>3)this.me.finished=true;
    }
    this.prevCheckpoint=this.me.checkpoint;

    this.drawKarts();
    if(time-this.lastSend>50 && socket){
      socket.emit("state",this.me); this.lastSend=time;
    }

    const all=[{...this.me,id:myId,name:playerName,color:"#ffffff"},...remote.values()];
    all.sort((a,b)=>(b.lap-a.lap)||(b.checkpoint-a.checkpoint));
    this.leader.setText(all.slice(0,6).map((p,i)=>`${i+1}. ${p.name}`).join("\n"));
  }
  getCheckpoint(){
    const {x,y}=this.me;
    if(Math.abs(x-640)<120&&y<190)return 0;
    if(x>930&&Math.abs(y-360)<150)return 1;
    if(Math.abs(x-640)<120&&y>530)return 2;
    if(x<350&&Math.abs(y-360)<150)return 3;
    return this.prevCheckpoint??0;
  }
  drawKarts(){
    if(this.kart)this.kart.destroy();
    this.kart=this.makeKart(this.me.x,this.me.y,this.me.angle,"#ffffff",playerName);
    for(const p of remote.values()){
      if(!p.finished)this.makeKart(p.x,p.y,p.angle,p.color,p.name);
    }
  }
  makeKart(x,y,a,color,name){
    const c=this.add.container(x,y).setRotation(a);
    const body=this.add.graphics();
    body.fillStyle(Phaser.Display.Color.HexStringToColor(color).color).fillRoundedRect(-22,-13,44,26,7);
    body.fillStyle(0x111827).fillRoundedRect(-8,-10,16,20,4);
    body.lineStyle(2,0xffffff,.8).strokeRoundedRect(-22,-13,44,26,7);
    body.fillStyle(0x111111).fillRect(-25,-14,7,9).fillRect(-25,5,7,9).fillRect(18,-14,7,9).fillRect(18,5,7,9);
    c.add(body);
    c.add(this.add.text(-31,-42,name,{fontSize:"12px",fontStyle:"bold",color:"#fff",stroke:"#000",strokeThickness:4}));
    c.add(this.add.text(-28,15,"Recruitr™",{fontSize:"8px",fontStyle:"bold",color:"#fff"}));
    return c;
  }
}

function connect(){
 socket=io(SERVER_URL,{transports:["websocket","polling"]});
 socket.on("connect_error",e=>document.getElementById("status").textContent="Server connection failed.");
 socket.on("joinError",msg=>document.getElementById("status").textContent=msg);
 socket.on("joined",data=>{
   myId=data.id; roomCode=data.roomCode; data.players.forEach(p=>remote.set(p.id,p));
   new Phaser.Game({type:Phaser.AUTO,width:1280,height:720,parent:"game",scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[RaceScene]});
 });
}

document.getElementById("join").onclick=()=>{
 playerName=document.getElementById("name").value.trim()||"Player";
 roomCode=document.getElementById("room").value.trim().toUpperCase()||"FUNBOX";
 document.getElementById("status").textContent="Connecting...";
 if(!socket) connect();
 socket?.emit("joinRoom",{roomCode,name:playerName});
};
