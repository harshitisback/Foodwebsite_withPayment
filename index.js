const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const session = require('express-session');



const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "secret" }))


function isProductInCart(cart, id) {
    for (let i = 0; i < cart.length; i++) {

        if (cart[i].id == id) {
            return true;
        }

    }

    return false;
}


function calculateTotal(cart, req) {
    total = 0;
    for (let i = 0; i < cart.length; i++) {
        const element = cart[i];
        if (cart[i].sale_price) {
            total = total + (cart[i].sale_price * cart[i].quantity);
        } else {
            total = total + (cart[i].price * cart[i].quantity);
        }

    }

    req.session.total = total;
    return total;
}

app.get('/', function (req, res) {

    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "foodsite"

    })

    con.query("SELECT * FROM products", (err, result) => {



        if (err) {
            console.log(err);
        } else {
            res.render("pages/index", { data: result });
            console.log("connection stablished");
        }

    })

})

app.post("/add_to_cart", function (req, res) {
    var id = req.body.id;
    var name = req.body.name;
    var price = req.body.price;
    var sale_price = req.body.sale_price;
    var quantity = req.body.quantity;
    var image = req.body.image;



    var product = { id: id, name: name, price: price, sale_price: sale_price, quantity: quantity, image: image };

    if (req.session.cart) {
        var cart = req.session.cart;

        if (!isProductInCart(cart, id)) {
            cart.push(product);
        }
    } else {
        req.session.cart = [product];
        var cart = req.session.cart;
    }

    // calculate total 
    calculateTotal(cart, req);

    // redirect to cart 
    res.redirect('/cart');

})

app.get("/cart", function (req, res) {
    var cart = req.session.cart;
    var total = req.session.total;


    res.render("pages/cart", { cart: cart, total: total });
})

app.post("/remove_product", function (req, res) {
    var id = req.body.id;
    var cart = req.session.cart;
 
    for(let i=0; i<cart.length; i++){
       if(cart[i].id == id){
          cart.splice(cart.indexOf(i),1);
       }
    }

  
    calculateTotal(cart, req);

    res.redirect('/cart');
})


app.post('/edit_product_quantity', function (req, res) {
    // values 
    var id = req.body.id;
    var quantity = req.body.quantity;
    var increase_btn = req.body.increase_product_quantity_btn;
    var decrease_btn = req.body.decrease_product_quantity_btn;

    var cart = req.session.cart;



    if (increase_btn) {
        for (var i = 0; i < cart.length; i++) {

            cart[i].quantity = parseInt(cart[i].quantity) + 1;
            if (cart[i].id === id) {
                cart[i].quantity = parseInt(cart[i].quantity) + 1;
                // if(cart[i].quantity>0){
                //     cart[i].quantity = parseInt(cart[i].quantity)+1;
                //     console.log(cart[i].quantity);
                // }
            }
        }
    }

    if (decrease_btn) {
        for (let i = 0; i < cart.length; i++) {

            cart[i].quantity = parseInt(cart[i].quantity) - 1;
            if (cart[i].id == id) {

                if (cart[i].quantity > 1) {

                    cart[i].quantity = parseInt(cart[i].quantity) - 1;
                    console.log(cart[i].quantity);
                }
            }
        }
    }

    calculateTotal(cart, req);
    res.redirect('/cart')
})


app.get('/checkout', function (req, res) {
    var total = req.session.total;

    res.render('pages/checkout'), { total: total };
})

app.post('/place_order', function (req, res) {
    var name = req.body.name;
    var email = req.body.email;
    var phone = req.body.phone;
    var city = req.body.city;
    var address = req.body.address;
    var cost = req.session.total;
    var status = "not paid";
    var date = new Date();
    var products_ids="";
    var id = Date.now();
    req.session.order_id = id;

    


    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "foodsite"
    });

    var cart = req.session.cart;
    for(let i=0; i<cart.length; i++){
       products_ids = products_ids + "," +cart[i].id;
    }

    con.connect(function (err) {
        if (err) throw err;
        console.log("Connected!");
        var sql = "INSERT INTO orders (id,cost,name,email,status,city,address,phone,date,products_ids) VALUES ?";
        var values = [
            [id,cost, name,email,status, city,address, phone, date, products_ids]
            ];
        con.query(sql, [values], function (err, result) {

            if (err) throw err;
            for(let i=0;i<cart.length;i++){
                var query = "INSERT INTO order_items (order_id,product_id,product_name,product_price,product_image,product_quantity,order_date) VALUES ?";
                var values = [
                   [id,cart[i].id,cart[i].name,cart[i].price,cart[i].image,cart[i].quantity,new Date()]
                ];
                con.query(query,[values],(err,result)=>{})
             }
            res.redirect('/payment');
        });
    });

})

app.get('/payment', function (req, res) {
    var total = req.session.total;
    res.render('pages/payment', {total:total})
})

app.get("/verify_payment",function(req,res){
    var transaction_id = req.query.transaction_id;
    var order_id = req.session.order_id;
 
    var con =  mysql.createConnection({
       host:"localhost",
       user:"root",
       password:"",
       database:"foodsite"
    })
    
 
    con.connect((err)=>{
             if(err){
                console.log(err);
             }else{
                var query = "INSERT INTO payments (order_id,transaction_id,date) VALUES ?";
                var values = [
                   [order_id,transaction_id,new Date()]
                ]
                con.query(query,[values],(err,result)=>{
                   
                   con.query("UPDATE orders SET status='paid' WHERE id='"+order_id+"'",(err,result)=>{})
                   res.redirect('/thank_you')
                
                })
             }  
       })   
    
 })


 app.get("/thank_you",function(req,res){

    var order_id = req.session.order_id;
    res.render("pages/thank_you",{order_id:order_id})
 })


 app.get('/single_product',function(req,res){

    var id = req.query.id;
 
    var con = mysql.createConnection({
       host:"localhost",
       user:"root",
       password:"",
       database:"foodsite"
    })
 
    con.query("SELECT * FROM products WHERE id='"+id+"'",(err,result)=>{
       res.render('pages/single_product',{result:result});
    })
 
 
 
 });


 app.get('/about',function(req,res){
   
    res.render('pages/about');
 });


app.listen(3000, function () {
    console.log("server started at port 3000");
})